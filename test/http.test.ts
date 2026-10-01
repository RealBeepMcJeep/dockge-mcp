import { afterEach, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fixture, yaml } from "./fixture.js";
import { serve } from "../src/http.js";
let f: Awaited<ReturnType<typeof fixture>>;
let http: ReturnType<typeof serve>;
let client: Client;
afterEach(async () => { await client?.close(); await http?.close(); await f?.close(); });
async function setup() {
  f = await fixture(); http = serve(f.service); const base = `http://127.0.0.1:${http.server.port}`;
  f.config.allowedHosts = [new URL(base).host];
  return base;
}
test("HTTP requires bearer and exact host/origin, while health exposes no Dockge details", async () => {
  const base = await setup();
  expect((await fetch(base + "/mcp")).status).toBe(401);
  expect((await fetch(base + "/healthz")).status).toBe(200);
  expect((await fetch(base + "/mcp", { headers: { authorization: `Bearer ${f.config.bearer}`, origin: "http://evil.example" } })).status).toBe(403);
  f.config.allowedHosts = ["expected.example"];
  expect((await fetch(base + "/healthz")).status).toBe(403);
});
test("real MCP client negotiates HTTP, discovers strict tool schemas, rejects environment smuggling and executes operations", async () => {
  const base = await setup();
  client = new Client({ name: "fixture-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), { requestInit: { headers: { authorization: `Bearer ${f.config.bearer}` } } });
  await client.connect(transport);
  const tools = await client.listTools(); expect(tools.tools.length).toBe(24);
  const edit = tools.tools.find(t => t.name === "edit_stack")!;
  expect(edit.inputSchema.additionalProperties).toBe(false);
  const bad = await client.callTool({ name: "create_stack", arguments: { agent_id: "primary", stack_name: "new", compose_yaml: yaml, env_content: "DO_NOT_ACCEPT=secret" } });
  expect(bad.isError).toBe(true); expect(f.calls.some(c => c.event === "saveStack")).toBe(false);
  const read = await client.callTool({ name: "get_stack", arguments: { agent_id: "primary", stack_name: "demo" } });
  expect(JSON.stringify(read)).not.toContain("super-secret-env-value");
  const result = await client.callTool({ name: "stop_stack", arguments: { agent_id: "primary", stack_name: "demo" } });
  const data = (result.structuredContent as any).data;
  expect(data.state).toBe("accepted"); await f.settled(data.operation_id);
  const status = await client.callTool({ name: "operation_status", arguments: { operation_id: data.operation_id } });
  expect((status.structuredContent as any).data.state).toBe("succeeded");
  expect((await client.callTool({ name: "get_stack_env", arguments: { agent_id: "primary", stack_name: "demo" } })).isError).toBe(true);
  expect((await client.callTool({ name: "list_networks", arguments: { agent_id: "primary" } })).structuredContent).toEqual({ ok: true, data: { agent_id: "primary", networks: ["bridge"], observed_at: expect.any(String) } });
});
test("MCP protocol baseline, session deletion and request bounds", async () => {
  const base = await setup();
  const headers = { authorization: `Bearer ${f.config.bearer}`, "Content-Type": "application/json", accept: "application/json, text/event-stream" };
  const init = await fetch(base + "/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "wire-test", version: "1" } } }) });
  expect((await init.json() as any).result.protocolVersion).toBe("2025-11-25");
  const id = init.headers.get("mcp-session-id")!; expect(id).toBeTruthy();
  const deleted = await fetch(base + "/mcp", { method: "DELETE", headers: { ...headers, "mcp-session-id": id, "mcp-protocol-version": "2025-11-25" } });
  expect(deleted.status).toBe(200);
  expect((await fetch(base + "/mcp", { headers: { ...headers, "mcp-session-id": id } })).status).toBe(404);
  expect((await fetch(base + "/mcp", { method: "POST", headers, body: "x".repeat(f.config.maxBytes + 1) })).status).toBe(413);
});
