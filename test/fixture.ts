// Wire fixture transcribed from Dockge tag 1.5.0 (bac498f97ffc33f7ffb2380bd68493de0719f4dd).
// Actual Dockge/Docker integration runs separately; this fixture injects failure/order cases.
import { createServer } from "node:http";
import { Server } from "socket.io";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Dockge } from "../src/dockge.js";
import { Ledger } from "../src/ledger.js";
import { Service } from "../src/service.js";
import type { Config } from "../src/core.js";

export const yaml = "services:\n  app:\n    image: alpine:3.21\n    command: sleep infinity\n";
export async function waitFor<T>(fn: () => T, predicate: (value: T) => boolean, timeout = 2500): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = fn(); if (predicate(value)) return value; await Bun.sleep(10); }
  throw new Error("Timed out waiting for test condition");
}
export async function fixture(overrides: Partial<Config> = {}) {
  const http = createServer();
  const io = new Server(http, { transports: ["websocket"] });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "dockge-mcp-test-"));
  const config: Config = { dockgeUrl: `http://127.0.0.1:${port}`, username: "test", password: "fixture-secret-password", bearer: "fixture-bearer-key-with-more-than-32-characters",
    host: "127.0.0.1", port: 0, allowedHosts: [], allowedOrigins: [], allowedAgents: [],
    permissions: { write: true, delete: false, envRead: false, envWrite: false }, stateDir: dir,
    profile: "1.5.0", readTimeoutMs: 500, mutationTimeoutMs: 150, maxBytes: 1024 * 1024, logBytes: 65536, ...overrides };
  const documents = new Map<string, { yaml: string; env: string; status: number }>();
  documents.set("/demo", { yaml, env: "PASSWORD=super-secret-env-value\n", status: 3 });
  documents.set("other:5001/demo", { yaml: yaml + "# remote\n", env: "REMOTE=keep-remote\n", status: 4 });
  const calls: { endpoint: string; event: string; args: unknown[] }[] = [];
  const controls = { snapshotBeforeAck: true, droppedAck: "", fail: "", disconnect: "", ignoreEnv: false, version: "1.5.0", terminalOutput: ["first\n", "super-secret-", "env-value\n"], loginJwt: "" };
  io.on("connection", socket => {
    const login = (ack: (data: unknown) => void) => {
      socket.emit("info", { version: controls.version });
      socket.emit("agentList", { ok: true, agentList: { "": { endpoint: "" }, "other:5001": { endpoint: "other:5001", password: "must-not-forward" } } });
      socket.emit("agentStatus", { endpoint: "other:5001", status: "online" });
      ack({ ok: true, token: "fixture-jwt" });
    };
    socket.on("login", (_data, ack) => login(ack));
    socket.on("loginByToken", (token, ack) => { controls.loginJwt = token; login(ack); });
    socket.on("composerize", (_command, ack) => ack({ ok: true, composeTemplate: yaml }));
    socket.on("agent", (endpoint: string, event: string, ...raw: any[]) => {
      const ack = raw.pop() as (data: any) => void, args = raw;
      calls.push({ endpoint, event, args });
      const name = args[0], key = `${endpoint}/${name}`;
      const summary = (name: string, doc: { status: number }) => ({ name, status: doc.status, tags: [], isManagedByDockge: true, composeFileName: "compose.yaml", endpoint });
      if (event === "requestStackList") {
        const list = Object.fromEntries([...documents].filter(([key]) => key.startsWith(`${endpoint}/`)).map(([key, doc]) => [key.slice(endpoint.length + 1), summary(key.slice(endpoint.length + 1), doc)]));
        const push = () => socket.emit("agent", "stackList", { ok: true, endpoint, stackList: list });
        if (controls.snapshotBeforeAck) { push(); ack({ ok: true }); } else { ack({ ok: true }); setTimeout(push, 5); }
        return;
      }
      if (event === "getStack") {
        const doc = documents.get(key);
        if (!doc) return ack({ ok: false, msg: "Stack not found" });
        return ack({ ok: true, stack: { ...summary(name, doc), composeYAML: doc.yaml, composeENV: doc.env, primaryHostname: "fixture" } });
      }
      if (event === "leaveCombinedTerminal") return ack({ ok: true });
      if (event === "terminalJoin") return ack({ ok: true, buffer: "fixture\n".repeat(1000) });
      if (event === "serviceStatusList") return ack({ ok: true, serviceStatusList: { app: "running" } });
      if (event === "getDockerNetworkList") return ack({ ok: true, dockerNetworkList: ["bridge"] });
      if (["saveStack", "deployStack"].includes(event)) {
        if (args[3] && documents.has(key)) return ack({ ok: false });
        const old = documents.get(key);
        documents.set(key, { yaml: args[1], env: controls.ignoreEnv ? old?.env ?? "" : args[2], status: event === "deployStack" ? 3 : old?.status ?? 1 });
      } else {
        const doc = documents.get(key); if (!doc) return ack({ ok: false });
        if (event === "deleteStack") documents.delete(key);
        if (event === "stopStack") doc.status = 4;
        if (event === "startStack") doc.status = 3;
        for (const chunk of controls.terminalOutput) socket.emit("agent", "terminalWrite", `compose-${endpoint}-${name}`, chunk);
      }
      if (controls.disconnect === event) { socket.disconnect(true); return; }
      if (controls.droppedAck === event) return;
      ack(controls.fail === event ? { ok: false, msg: "Error with super-secret-env-value" } : { ok: true });
    });
  });
  const dockge = new Dockge(config), ledger = new Ledger(dir, config.logBytes), service = new Service(config, dockge, ledger);
  dockge.connect();
  await waitFor(() => dockge.status().authenticated, Boolean);
  return { config, dockge, ledger, service, documents, calls, controls, dir,
    settled: (id: string) => waitFor(() => ledger.get(id), op => !["accepted", "running"].includes(op.state)),
    async close() { await service.close(); await new Promise<void>(resolve => io.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); } };
}
