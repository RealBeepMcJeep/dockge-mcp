import { afterEach, expect, test } from "bun:test";
import { fixture, yaml, waitFor } from "./fixture.js";
import { Ledger } from "../src/ledger.js";
import { Dockge } from "../src/dockge.js";
import { Service } from "../src/service.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
let f: Awaited<ReturnType<typeof fixture>>;
afterEach(async () => { if (f) await f.close(); });
const target = { agent_id: "primary", stack_name: "demo" };

test("fresh discovery works for push-before-ACK and push-after-ACK, preserving endpoint isolation", async () => {
  f = await fixture();
  const primary = await f.service.stacks("primary"); expect(primary.stacks[0].status).toBe(3);
  f.controls.snapshotBeforeAck = false;
  const remote = f.dockge.listAgents().find(a => a.endpoint === "other:5001")!;
  expect(JSON.stringify(f.dockge.listAgents())).not.toContain("must-not-forward");
  expect((await f.service.stacks(remote.agent_id)).stacks[0].status).toBe(4);
  expect(f.calls.at(-1)?.endpoint).toBe("other:5001");
  expect(() => f.dockge.target("https://arbitrary-host")).toThrow("Unknown agent");
});
test("coalesced stack refresh installs its listener before dispatch", async () => {
  f = await fixture();
  f.controls.snapshotBeforeAck = false;
  await Promise.all([f.dockge.stacks("primary"), f.dockge.stacks("primary")]);
  expect(f.calls.filter(c => c.event === "requestStackList")).toHaveLength(1);
});
test("general reads strip environment; YAML edit preserves environment and verifies readback", async () => {
  f = await fixture(); const read = await f.service.get(target);
  expect(JSON.stringify(read)).not.toContain("super-secret-env-value");
  const op = f.service.mutate("edit_stack", { ...target, compose_yaml: yaml + "# changed\n", expected_revision: "revision" in read ? read.revision : "" });
  expect(op.state).toBe("accepted"); expect((await f.settled(op.operation_id)).state).toBe("succeeded");
  expect(f.documents.get("/demo")?.env).toBe("PASSWORD=super-secret-env-value\n");
  expect(f.calls.some(c => c.event === "saveStack" && c.args[3] === false)).toBe(true);
});
test("stale YAML revision fails before save dispatch", async () => {
  f = await fixture(); const read = await f.service.get(target);
  f.documents.get("/demo")!.yaml += "# concurrent UI edit\n";
  const op = f.service.mutate("edit_stack", { ...target, compose_yaml: yaml, expected_revision: "revision" in read ? read.revision : "" });
  expect((await f.settled(op.operation_id)).error_code).toBe("conflict");
  expect(f.calls.filter(c => c.event === "saveStack")).toHaveLength(0);
});
test("environment read and write permissions are independent of ordinary write", async () => {
  f = await fixture({ permissions: { write: false, delete: false, envRead: false, envWrite: true } });
  await expect(f.service.get(target, true)).rejects.toThrow("disabled");
  expect(() => f.service.mutate("start_stack", target)).toThrow("disabled");
  const read = await f.service.get(target);
  const op = f.service.mutate("set_stack_env", { ...target, env_content: "NEW=replacement-secret\n", expected_env_revision: read.env_revision });
  expect((await f.settled(op.operation_id)).state).toBe("succeeded");
  expect(f.documents.get("/demo")?.yaml).toBe(yaml); expect(f.documents.get("/demo")?.env).toBe("NEW=replacement-secret\n");
  expect(f.calls.filter(c => c.event === "deployStack")).toHaveLength(0);
  expect(JSON.stringify(f.ledger.get(op.operation_id))).not.toContain("replacement-secret");
  expect(readFileSync(join(f.dir, "operations.sqlite-wal")).includes(Buffer.from("replacement-secret"))).toBe(false);
});
test("ordinary write cannot enable environment access, and env-read cannot enable env-write", async () => {
  f = await fixture({ permissions: { write: true, delete: false, envRead: true, envWrite: false } });
  expect((await f.service.get(target, true))).toHaveProperty("env_content", "PASSWORD=super-secret-env-value\n");
  expect(() => f.service.mutate("set_stack_env", { ...target, env_content: "", expected_env_revision: "a".repeat(64) })).toThrow("disabled");
  expect(() => f.service.mutate("delete_stack", target)).toThrow("disabled");
});
test("stale environment revision fails before dispatch", async () => {
  f = await fixture({ permissions: { write: false, delete: false, envRead: false, envWrite: true } });
  const read = await f.service.get(target); f.documents.get("/demo")!.env = "CHANGED=UI\n";
  const op = f.service.mutate("set_stack_env", { ...target, env_content: "NEW=x", expected_env_revision: read.env_revision });
  expect((await f.settled(op.operation_id)).error_code).toBe("conflict"); expect(f.calls.some(c => c.event === "saveStack")).toBe(false);
});
test("incompatible environment persistence or an external save race retains an unknown guard", async () => {
  f = await fixture({ permissions: { write: true, delete: false, envRead: false, envWrite: true } });
  f.controls.ignoreEnv = true; const read = await f.service.get(target);
  const op = f.service.mutate("set_stack_env", { ...target, env_content: "NEW=ignored\n", expected_env_revision: read.env_revision });
  expect((await f.settled(op.operation_id)).state).toBe("unknown");
  expect(() => f.service.mutate("start_stack", target)).toThrow("active or unknown");
  expect(() => f.service.resolve(op.operation_id, "observed incompatible build")).not.toThrow();
});
test("lost mutation ACK is never replayed and keeps guard until explicit resolution", async () => {
  f = await fixture(); f.controls.droppedAck = "stopStack";
  const op = f.service.mutate("stop_stack", target);
  expect(() => f.service.mutate("restart_stack", target)).toThrow("active or unknown");
  expect((await f.settled(op.operation_id)).state).toBe("unknown");
  expect(f.calls.filter(c => c.event === "stopStack")).toHaveLength(1);
  expect(f.service.resolve(op.operation_id, "Inspected Dockge; command finished.").state).toBe("resolved");
  f.controls.droppedAck = "";
  expect((await f.settled(f.service.mutate("start_stack", target).operation_id)).state).toBe("succeeded");
});
test("command failure is distinct from uncertainty and does not echo upstream secret errors", async () => {
  f = await fixture(); f.controls.fail = "restartStack";
  const row = await f.settled(f.service.mutate("restart_stack", target).operation_id);
  expect(row.state).toBe("failed"); expect(row.error_code).toBe("command_failed");
  expect(JSON.stringify(row)).not.toContain("super-secret-env-value"); expect(row.logs).toContain("[REDACTED]");
});
test("deploy failure after saving is recorded without claiming rollback", async () => {
  f = await fixture(); f.controls.fail = "deployStack"; const read = await f.service.get(target);
  const row = await f.settled(f.service.mutate("deploy_stack", { ...target, expected_revision: "revision" in read ? read.revision : "" }).operation_id);
  expect(row.state).toBe("failed"); expect(row.message).toContain("partial effects"); expect(row.logs).toBe("");
});
test("disconnected target is unavailable before acceptance; post-dispatch disconnect becomes unknown", async () => {
  f = await fixture(); f.controls.disconnect = "updateStack";
  const row = await f.settled(f.service.mutate("update_stack", target).operation_id);
  expect(row.state).toBe("unknown"); expect(() => f.service.mutate("start_stack", target)).toThrow("offline or not authenticated");
  f.controls.disconnect = ""; f.dockge.connect(); await waitFor(() => f.dockge.status().authenticated, Boolean);
  expect(() => f.service.mutate("start_stack", target)).toThrow("active or unknown");
});
test("restart converts running operations to unknown and preserves guard and opaque revision secret", async () => {
  f = await fixture(); const secret = f.ledger.secret;
  const op = f.ledger.accept("primary", "demo", "update_stack"); f.ledger.state(op.operation_id, "running");
  // Independent ledger startup is equivalent to a new bridge process opening the durable state.
  const recovered = new Ledger(f.dir);
  try {
    expect(recovered.secret).toBe(secret); expect(recovered.get(op.operation_id).state).toBe("unknown");
    expect(() => recovered.accept("primary", "demo", "start_stack")).toThrow("active or unknown");
  } finally { recovered.close(); }
});
test("log retention does not expire unknown guards, while resolved history is finite", async () => {
  f = await fixture(); let now = Date.now(); const ledger = new Ledger(join(f.dir, "retention"), 20, () => now);
  try {
    const op = ledger.accept("primary", "demo", "stop_stack"); ledger.append(op.operation_id, "x".repeat(100)); ledger.state(op.operation_id, "unknown");
    expect(ledger.get(op.operation_id).logs).toHaveLength(20); expect(ledger.get(op.operation_id).truncated).toBe(1);
    now += 86400001; expect(ledger.get(op.operation_id).logs).toBe(""); expect(ledger.get(op.operation_id).state).toBe("unknown");
    ledger.resolve(op.operation_id, "verified"); now += 86400001; expect(() => ledger.get(op.operation_id)).toThrow("expired");
  } finally { ledger.close(); }
});
test("bounded logs never follow and release the upstream combined terminal", async () => {
  f = await fixture(); const result = await f.dockge.logs("primary", "demo", 100);
  expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(100); expect(result.truncated).toBe(true);
  expect(f.calls.at(-1)?.event).toBe("leaveCombinedTerminal");
});
test("JWT login and mismatched release handling are explicit", async () => {
  f = await fixture({ jwt: "configured-jwt" }); expect(f.controls.loginJwt).toBe("configured-jwt");
  f.controls.version = "1.4.0"; f.dockge.close(); f.dockge.connect();
  await waitFor(() => f.dockge.status().reported_version, v => v === "1.4.0");
  expect(() => f.service.mutate("start_stack", target)).toThrow("must report version");
});
test("agent allowlists deny reads and writes without arbitrary endpoint routing", async () => {
  f = await fixture({ allowedAgents: ["primary"] });
  expect(f.dockge.listAgents()).toHaveLength(1);
  expect(() => f.dockge.target("other:5001")).toThrow("outside the configured allowlist");
});
