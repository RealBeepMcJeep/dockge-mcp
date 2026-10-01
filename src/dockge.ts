import { io, type Socket } from "socket.io-client";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { BridgeError, bounded, type Config } from "./core.js";

type Ack = Record<string, any>;
export type Agent = { agent_id: string; endpoint: string; online: boolean; profile: string; profile_verified: false };
export type StackDocument = Record<string, unknown> & { name: string; composeYAML: string; composeENV: string };
export class Dockge extends EventEmitter {
  readonly socket: Socket;
  private authenticated = false;
  private version?: string;
  private agents = new Map<string, Agent>();
  private endpointStatus = new Map<string, boolean>();
  private pending = new Set<(error: BridgeError) => void>();
  private refreshes = new Map<string, Promise<Record<string, unknown>>>();
  private logReads = new Set<string>();
  private logUsers = new Map<string, number>();
  constructor(readonly config: Config) {
    super();
    this.socket = io(config.dockgeUrl, { autoConnect: false, transports: ["websocket"], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
    this.agents.set("primary", this.agent(""));
    this.socket.on("connect", () => { void this.login(); });
    this.socket.on("disconnect", () => {
      this.authenticated = false; this.version = undefined; this.agents.clear(); this.endpointStatus.clear();
      this.agents.set("primary", this.agent(""));
      for (const reject of [...this.pending]) reject(new BridgeError("unavailable", "Dockge connection closed."));
      this.emit("availability");
    });
    this.socket.on("info", data => { if (typeof data?.version === "string") this.version = data.version; });
    this.socket.on("agentStatus", data => {
      if (typeof data?.endpoint !== "string") return;
      this.endpointStatus.set(data.endpoint, data.status === "online");
      for (const agent of this.agents.values()) if (agent.endpoint === data.endpoint) agent.online = data.status === "online";
    });
    this.socket.on("agentList", data => {
      if (!data?.ok || !data.agentList || typeof data.agentList !== "object") return;
      const next = new Map<string, Agent>(); next.set("primary", this.agent(""));
      for (const endpoint of Object.keys(data.agentList)) {
        if (!endpoint || endpoint === "##ALL_DOCKGE_ENDPOINTS##") continue;
        const agent = this.agent(endpoint); next.set(agent.agent_id, agent);
      }
      this.agents = next;
    });
    this.socket.on("agent", (event: unknown, ...args: unknown[]) => {
      if (event === "stackList") {
        const data = args[0] as Ack;
        if (data?.ok && typeof data.endpoint === "string" && data.stackList && typeof data.stackList === "object") this.emit(`snapshot:${data.endpoint}`, data.stackList);
      }
      if (event === "terminalWrite" && typeof args[0] === "string" && typeof args[1] === "string") this.emit("terminal", args[0], args[1]);
    });
  }
  private agent(endpoint: string): Agent {
    return { agent_id: endpoint ? `agent-${createHash("sha256").update(endpoint).digest("hex").slice(0, 16)}` : "primary", endpoint,
      online: endpoint ? this.endpointStatus.get(endpoint) === true : this.authenticated, profile: this.config.profile, profile_verified: false };
  }
  connect() { this.socket.connect(); }
  close() { this.socket.disconnect(); }
  status() { return { connected: this.socket.connected, authenticated: this.authenticated, reported_version: this.version ?? null, configured_profile: this.config.profile,
    profile_verified: false, compatible_reported_version: this.version === "1.5.0", observed_at: new Date().toISOString() }; }
  listAgents(): Agent[] {
    return [...this.agents.values()].filter(a => !this.config.allowedAgents.length || this.config.allowedAgents.includes(a.agent_id)).map(a => ({ ...a, online: a.agent_id === "primary" ? this.authenticated : a.online }));
  }
  target(id: string): Agent {
    if (this.config.allowedAgents.length && !this.config.allowedAgents.includes(id)) throw new BridgeError("forbidden", "Agent is outside the configured allowlist.");
    const agent = this.agents.get(id);
    if (!agent) throw new BridgeError("not_found", "Unknown agent; discover registered agents with list_agents.");
    if (!this.socket.connected || !this.authenticated || (id !== "primary" && !agent.online)) throw new BridgeError("unavailable", "Target Dockge agent is offline or not authenticated.");
    if (this.version !== "1.5.0") throw new BridgeError("unsupported", "Primary Dockge must report version 1.5.0 and use the configured official release profile.");
    return agent;
  }
  private async login() {
    try {
      const ack = await this.emitAck(undefined, this.config.jwt ? "loginByToken" : "login",
        [this.config.jwt ?? { username: this.config.username, password: this.config.password }], false, this.config.readTimeoutMs, false);
      this.authenticated = ack.ok === true;
      const primary = this.agents.get("primary"); if (primary) primary.online = this.authenticated;
      this.emit("availability");
    } catch { this.authenticated = false; this.emit("availability"); }
  }
  private emitAck(endpoint: string | undefined, event: string, args: unknown[], mutation: boolean, timeout: number, validate = true): Promise<Ack> {
    if (!this.socket.connected) return Promise.reject(new BridgeError("unavailable", "Dockge is disconnected before dispatch."));
    if (this.pending.size >= 1024) return Promise.reject(new BridgeError("busy", "Dockge request capacity reached before dispatch."));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: BridgeError, value?: Ack) => {
        if (settled) return; settled = true; clearTimeout(timer); this.pending.delete(disconnect);
        if (error) reject(error); else resolve(value!);
      };
      const disconnect = () => finish(new BridgeError(mutation ? "unknown" : "unavailable", mutation ? "Connection lost after mutation dispatch; outcome is unknown." : "Dockge disconnected during observation.", mutation));
      const timer = setTimeout(() => finish(new BridgeError(mutation ? "unknown" : "unavailable", mutation ? "Mutation ACK timed out; outcome is unknown." : "Dockge observation timed out.", mutation)), timeout);
      this.pending.add(disconnect);
      const ack = (value: unknown) => {
        if (!value || typeof value !== "object" || typeof (value as Ack).ok !== "boolean") return finish(new BridgeError(mutation ? "unknown" : "unsupported", "Dockge returned an invalid acknowledgement.", mutation));
        if (validate && !(value as Ack).ok) return finish(new BridgeError("command_failed", "Dockge rejected or failed the command; partial effects may remain.", mutation));
        finish(undefined, value as Ack);
      };
      if (endpoint === undefined) this.socket.emit(event, ...args, ack);
      else this.socket.emit("agent", endpoint, event, ...args, ack);
    });
  }
  call(id: string, event: string, args: unknown[] = [], mutation = false) {
    const agent = this.target(id);
    return this.emitAck(agent.endpoint, event, args, mutation, mutation ? this.config.mutationTimeoutMs : this.config.readTimeoutMs);
  }
  async converter(command: string) {
    this.target("primary");
    const result = await this.emitAck(undefined, "composerize", [command], false, this.config.readTimeoutMs);
    if (typeof result.composeTemplate !== "string") throw new BridgeError("unsupported", "Dockge returned an invalid conversion result.");
    return { compose_yaml: result.composeTemplate };
  }
  stacks(id: string): Promise<Record<string, unknown>> {
    const agent = this.target(id);
    const existing = this.refreshes.get(id); if (existing) return existing;
    const promise = this.refresh(agent).finally(() => this.refreshes.delete(id));
    this.refreshes.set(id, promise); return promise;
  }
  private async refresh(agent: Agent) {
    const event = `snapshot:${agent.endpoint}`;
    let cleanup = () => {};
    const snapshot = new Promise<Record<string, unknown>>((resolve, reject) => {
      const listener = (data: Record<string, unknown>) => { cleanup(); resolve(data); };
      const disconnected = () => { cleanup(); reject(new BridgeError("unavailable", "Dockge disconnected while refreshing stacks.")); };
      const timer = setTimeout(() => { cleanup(); reject(new BridgeError("unavailable", "Dockge did not send a fresh stack list.")); }, this.config.readTimeoutMs);
      cleanup = () => { clearTimeout(timer); this.off(event, listener); this.socket.off("disconnect", disconnected); };
      this.on(event, listener); this.socket.on("disconnect", disconnected);
    });
    try { const [stacks] = await Promise.all([snapshot, this.call(agent.agent_id, "requestStackList")]); return stacks; }
    finally { cleanup(); }
  }
  async document(id: string, name: string, keepLogs = false): Promise<StackDocument> {
    const key = `${id}/${name}`;
    this.logUsers.set(key, (this.logUsers.get(key) ?? 0) + 1);
    let successful = false;
    try {
      const result = await this.call(id, "getStack", [name]);
      const stack = result.stack;
      if (!stack || stack.name !== name || typeof stack.composeYAML !== "string" || typeof stack.composeENV !== "string") throw new BridgeError("unsupported", "Dockge returned an invalid stack document.");
      if (Buffer.byteLength(stack.composeYAML) + Buffer.byteLength(stack.composeENV) > this.config.maxBytes) throw new BridgeError("unsupported", "Stack documents exceed the bridge size limit.");
      successful = true; return stack;
    } finally { if (!keepLogs || !successful) await this.releaseLogs(id, name); }
  }
  private async releaseLogs(id: string, name: string) {
    const key = `${id}/${name}`, count = this.logUsers.get(key) ?? 0;
    if (count > 1) this.logUsers.set(key, count - 1);
    else { this.logUsers.delete(key); await this.call(id, "leaveCombinedTerminal", [name]).catch(() => {}); }
  }
  async detachOperationLogs(id: string, name: string) {
    // Native start/deploy subscribe this socket to combined logs after their ACK.
    if (!(this.logUsers.get(`${id}/${name}`) ?? 0)) await this.call(id, "leaveCombinedTerminal", [name]).catch(() => {});
  }
  terminalName(id: string, name: string, kind = "compose") { return `${kind}-${this.target(id).endpoint}-${name}`; }
  async logs(id: string, name: string, bytes: number) {
    const key = `${id}/${name}`;
    if (this.logReads.has(key)) throw new BridgeError("busy", "A log snapshot is already being read for this stack.");
    this.logReads.add(key);
    let joined = false;
    try {
      await this.document(id, name, true);
      joined = true;
      const result = await this.call(id, "terminalJoin", [this.terminalName(id, name, "combined")]);
      if (typeof result.buffer !== "string") throw new BridgeError("unsupported", "Dockge returned an invalid terminal buffer.");
      return { ...bounded(result.buffer, bytes), observed_at: new Date().toISOString(), source: "Dockge combined terminal", fresh: false,
        limitation: "Recent terminal buffer; shared and potentially stale. CLI output does not establish application readiness." };
    } finally { if (joined) await this.releaseLogs(id, name); this.logReads.delete(key); }
  }
}
