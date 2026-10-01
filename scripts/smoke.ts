import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";
const token = process.env.MCP_BEARER_TOKEN;
if (!token) throw new Error("MCP_BEARER_TOKEN required for smoke test");
for (let i = 0; ; i++) {
  try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {}
  if (i >= 60) throw new Error("HTTP listener did not start");
  await Bun.sleep(500);
}
if ((await fetch(`${base}/mcp`)).status !== 401) throw new Error("Unauthenticated MCP must be rejected");
const client = new Client({ name: "artifact-smoke", version: "1" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  const tools = await client.listTools();
  for (const name of ["list_stacks", "get_stack", "set_stack_env", "operation_status"]) if (!tools.tools.some(t => t.name === name)) throw new Error(`Missing ${name}`);
  const result = await client.callTool({ name: "status", arguments: {} });
  if (!(result.structuredContent as any)?.ok) throw new Error("Status call failed");
  console.log(`Artifact HTTP/MCP smoke passed (${tools.tools.length} tools)`);
} finally { await client.close(); }
