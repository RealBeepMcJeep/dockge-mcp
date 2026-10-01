// Disposable CI-only Dockge release test. Never point DOCKGE_TEST_URL at production.
import { io } from "socket.io-client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core.js";
import { Dockge } from "../src/dockge.js";
import { Ledger } from "../src/ledger.js";
import { Service } from "../src/service.js";
import { serve } from "../src/http.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.DOCKGE_TEST_URL;
if (!url || process.env.CI !== "true") throw new Error("This setup/mutation test requires CI=true and disposable DOCKGE_TEST_URL");
const username = "fixture-admin", password = "DisposableFixturePassword923!";
const socket = io(url, { transports: ["websocket"], timeout: 10000 });
const wait = async (fn: () => boolean, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (!fn()) { if (Date.now() >= end) throw new Error("Integration wait timed out"); await Bun.sleep(100); }
};
await wait(() => socket.connected);
const setup = await new Promise<any>(resolve => socket.timeout(10000).emit("setup", username, password, (error: Error | null, ack: any) => resolve(error ? { ok: false } : ack)));
socket.disconnect();
if (!setup?.ok) throw new Error("Disposable Dockge setup failed");
const dir = mkdtempSync(join(tmpdir(), "dockge-mcp-upstream-"));
const config = loadConfig({ DOCKGE_URL: url, DOCKGE_USERNAME: username, DOCKGE_PASSWORD: password,
  MCP_BEARER_TOKEN: "ci-disposable-mcp-token-32-characters-minimum", STATE_DIR: dir,
  DOCKGE_ALLOW_WRITE: "true", DOCKGE_ALLOW_DELETE: "true", DOCKGE_ALLOW_ENV_READ: "true", DOCKGE_ALLOW_ENV_WRITE: "true", DOCKGE_MUTATION_TIMEOUT_MS: "180000" });
config.port = 0; config.host = "127.0.0.1";
const dockge = new Dockge(config), service = new Service(config, dockge, new Ledger(dir));
const http = serve(service); config.allowedHosts = [`127.0.0.1:${http.server.port}`];
const client = new Client({ name: "actual-dockge-integration", version: "1" });
const target = { agent_id: "primary", stack_name: `mcp-ci-${Date.now()}` };
const compose = "services:\n  app:\n    image: alpine:3.21@sha256:ce64758a109eb420d874a118f87920e625e12d3634e03b4a5573fd9f6e5d3507\n    command: [sh, -c, 'echo mcp-fixture-started; sleep infinity']\n";
const call = async (name: string, args: Record<string, unknown>) => {
  const result = await client.callTool({ name, arguments: args });
  const envelope = result.structuredContent as any;
  if (result.isError || !envelope?.ok) throw new Error(`Integration tool ${name} failed: ${JSON.stringify(envelope?.error)}`);
  return envelope.data;
};
const mutate = async (name: string, extra = {}) => {
  const op = await call(name, { ...target, ...extra });
  let status: any;
  const end = Date.now() + 190000;
  do {
    status = await call("operation_status", { operation_id: op.operation_id });
    if (!["accepted", "running"].includes(status.state)) break;
    if (Date.now() >= end) throw new Error("Integration mutation wait timed out");
    await Bun.sleep(200);
  } while (true);
  if (status.state !== "succeeded") throw new Error(`Integration ${name} ended ${status.state}: ${status.message}`);
};
let created = false;
try {
  dockge.connect(); await wait(() => dockge.status().authenticated && dockge.status().reported_version === "1.5.0");
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${http.server.port}/mcp`), { requestInit: { headers: { authorization: `Bearer ${config.bearer}` } } }));
  await call("list_agents", {}); await call("list_networks", { agent_id: "primary" }); await call("scan_stacks", { agent_id: "primary" });
  await call("compose_from_docker_run", { command: "docker run --name example alpine:3.21 sleep infinity" });
  await mutate("create_stack", { compose_yaml: compose }); created = true;
  let read = await call("get_stack", target);
  if ("env_content" in read || "composeENV" in read) throw new Error("General stack read exposed environment");
  await mutate("set_stack_env", { env_content: "FIXTURE=preserve-this-value\n", expected_env_revision: read.env_revision });
  read = await call("get_stack", target);
  await mutate("edit_stack", { compose_yaml: compose + "# fixture edit\n", expected_revision: read.revision });
  const env = await call("get_stack_env", target);
  if (env.env_content !== "FIXTURE=preserve-this-value\n") throw new Error("YAML save did not preserve environment");
  read = await call("get_stack", target);
  await mutate("deploy_stack", { expected_revision: read.revision });
  await call("list_services", target); await call("stack_logs", { ...target, max_bytes: 1024 });
  await mutate("restart_stack"); await mutate("update_stack"); await mutate("stop_stack");
  await mutate("update_stack");
  const status = await call("stack_status", target);
  if (status.status === 3) throw new Error("Stopped-stack update unexpectedly started the stack");
  await mutate("start_stack"); await mutate("down_stack"); await mutate("delete_stack"); created = false;
  console.log("Actual Dockge 1.5.0 integration passed: save/env preservation, deploy, lifecycle, logs, stopped update and deletion.");
} finally {
  if (created) { try { await mutate("delete_stack"); } catch { console.error("Disposable stack cleanup failed; runner cleanup will remove the fixture."); } }
  await client.close(); await http.close(); await service.close(); rmSync(dir, { recursive: true, force: true });
}
