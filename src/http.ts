import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { equalSecret, type Config } from "./core.js";
import { createMcp } from "./mcp.js";
import { Service } from "./service.js";

type Session = { transport: WebStandardStreamableHTTPServerTransport; lastUsed: number; close: () => Promise<void>; active: number };
export function serve(service: Service, config: Config = service.config) {
  const sessions = new Map<string, Session>();
  let initializing = 0;
  const response = (status: number, error: string) => Response.json({ error }, { status });
  const timer = setInterval(() => {
    for (const [id, session] of sessions) if (session.active === 0 && Date.now() - session.lastUsed > 30 * 60 * 1000) {
      sessions.delete(id); void session.close();
    }
    service.ledger.prune();
  }, 60000);
  const server = Bun.serve({
    hostname: config.host, port: config.port, idleTimeout: 0, maxRequestBodySize: config.maxBytes,
    async fetch(request): Promise<Response> {
      const url = new URL(request.url);
      if (!config.allowedHosts.includes(url.host)) return response(403, "Host is not allowed");
      const origin = request.headers.get("origin");
      if (origin && !config.allowedOrigins.includes(origin)) return response(403, "Origin is not allowed");
      if (url.pathname === "/healthz" && request.method === "GET") return Response.json({ ok: true, service: "dockge-mcp" });
      if (url.pathname !== "/mcp") return response(404, "Not found");
      const authorization = request.headers.get("authorization") ?? "";
      if (!authorization.startsWith("Bearer ") || !equalSecret(authorization.slice(7), config.bearer)) return Response.json({ error: "Bearer authentication required" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
      if (!["GET", "POST", "DELETE"].includes(request.method)) return response(405, "Method not allowed");
      let body: unknown;
      if (request.method === "POST") {
        try {
          const data = await request.arrayBuffer();
          if (data.byteLength > config.maxBytes) return response(413, "Request exceeds size limit");
          body = JSON.parse(new TextDecoder().decode(data));
        } catch { return response(400, "Invalid JSON request"); }
      }
      const id = request.headers.get("mcp-session-id");
      let session = id ? sessions.get(id) : undefined;
      if (id && !session) return response(404, "Session expired or unknown; initialize a new session");
      if (!session) {
        if (request.method !== "POST" || !isInitializeRequest(body)) return response(400, "Initialize a session first");
        if (sessions.size + initializing >= 128) return response(503, "Session capacity reached");
        initializing++;
        const mcp = createMcp(service);
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID(), enableJsonResponse: true,
          onsessioninitialized: id => { sessions.set(id, session!); }, onsessionclosed: id => { sessions.delete(id); } });
        session = { transport, lastUsed: Date.now(), close: () => mcp.close(), active: 0 };
        try { await mcp.connect(transport); }
        catch { initializing--; await mcp.close(); return response(500, "Session initialization failed"); }
        session.active++;
        try { return await transport.handleRequest(request, { parsedBody: body }); }
        finally { session.active--; initializing--; if (!transport.sessionId) await mcp.close(); }
      }
      session.lastUsed = Date.now(); session.active++;
      try { return await session.transport.handleRequest(request, { parsedBody: body }); }
      catch { return response(500, "MCP request failed"); }
      finally { session.active--; }
    },
    error() { return response(500, "HTTP request failed"); },
  });
  return { server, async close() { clearInterval(timer); await Promise.allSettled([...sessions.values()].map(s => s.close())); sessions.clear(); await server.stop(true); } };
}
