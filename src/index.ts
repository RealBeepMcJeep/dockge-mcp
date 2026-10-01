import { loadConfig } from "./core.js";
import { Dockge } from "./dockge.js";
import { Ledger } from "./ledger.js";
import { Service } from "./service.js";
import { serve } from "./http.js";

export async function main() {
  const config = loadConfig();
  const ledger = new Ledger(config.stateDir, config.logBytes);
  const dockge = new Dockge(config);
  const service = new Service(config, dockge, ledger);
  const http = serve(service);
  dockge.connect();
  console.log(JSON.stringify({ event: "listening", host: config.host, port: http.server.port, profile: config.profile }));
  let closing = false;
  const stop = async () => {
    if (closing) return; closing = true;
    await http.close(); await service.close(); process.exit(0);
  };
  process.on("SIGTERM", () => { void stop(); });
  process.on("SIGINT", () => { void stop(); });
}
if (import.meta.main) main().catch(() => {
  // Configuration values and upstream errors can contain credentials. Never print them.
  console.error("Dockge MCP failed to start. Check required configuration, host/port and writable state directory.");
  process.exit(1);
});
