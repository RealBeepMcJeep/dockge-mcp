import { parse } from "yaml";
import { BridgeError, revision, safeError, type Config } from "./core.js";
import { Dockge, type StackDocument } from "./dockge.js";
import { Ledger, type Operation } from "./ledger.js";

export type Target = { agent_id: string; stack_name: string };
export type MutationInput = Target & { compose_yaml?: string; expected_revision?: string; expected_env_revision?: string; env_content?: string };
const wireEvents: Record<string, string> = {
  start_stack: "startStack", stop_stack: "stopStack", restart_stack: "restartStack", update_stack: "updateStack", down_stack: "downStack", delete_stack: "deleteStack",
};
export class Service {
  private tasks = new Set<Promise<void>>();
  private closing = false;
  constructor(readonly config: Config, readonly dockge: Dockge, readonly ledger: Ledger) {}
  permission(tool: string) {
    const allowed = tool === "get_stack_env" ? this.config.permissions.envRead : tool === "set_stack_env" ? this.config.permissions.envWrite : tool === "delete_stack" ? this.config.permissions.delete : this.config.permissions.write;
    if (!allowed) throw new BridgeError("forbidden", `Permission for ${tool} is disabled in bridge configuration.`);
  }
  private validateTarget(input: Target) {
    if (!/^[a-z0-9_-]{1,128}$/.test(input.stack_name)) throw new BridgeError("invalid_input", "Stack name must match Dockge's lowercase letters, digits, underscore and hyphen format (maximum 128 characters).");
    this.dockge.target(input.agent_id);
  }
  revisions(input: Target, document: StackDocument) {
    const key = `${input.agent_id}/${input.stack_name}`;
    return { revision: revision(this.ledger.secret, key, "yaml", document.composeYAML), env_revision: revision(this.ledger.secret, key, "env", document.composeENV) };
  }
  async get(input: Target, env = false) {
    this.validateTarget(input); if (env) this.permission("get_stack_env");
    const document = await this.dockge.document(input.agent_id, input.stack_name);
    const revisions = this.revisions(input, document);
    if (env) return { ...input, env_content: document.composeENV, env_revision: revisions.env_revision, observed_at: new Date().toISOString() };
    return { ...input, compose_yaml: document.composeYAML, ...revisions, metadata: this.metadata(document), observed_at: new Date().toISOString(),
      limitation: "Revisions support best-effort conflict detection; Dockge has no atomic compare-and-swap." };
  }
  metadata(document: Record<string, unknown>) {
    // Whitelist rather than forwarding unknown upstream fields, including environment content.
    return { name: document.name, status: document.status, managed: document.isManagedByDockge, compose_file_name: document.composeFileName, tags: document.tags };
  }
  async stacks(agent: string) {
    const list = await this.dockge.stacks(agent);
    return { agent_id: agent, stacks: Object.values(list).map(s => this.metadata(s as Record<string, unknown>)), observed_at: new Date().toISOString(), fresh: true,
      limitation: "Dockge aggregate status may hide mixed service states and is not application readiness." };
  }
  async stackStatus(input: Target) {
    this.validateTarget(input);
    const list = await this.dockge.stacks(input.agent_id);
    const stack = list[input.stack_name]; if (!stack) throw new BridgeError("not_found", "Stack is absent from the refreshed Dockge list.");
    return { ...input, ...this.metadata(stack as Record<string, unknown>), observed_at: new Date().toISOString(), fresh: true, readiness: "unknown" };
  }
  async services(input: Target) {
    this.validateTarget(input);
    const result = await this.dockge.call(input.agent_id, "serviceStatusList", [input.stack_name]);
    if (!result.serviceStatusList || typeof result.serviceStatusList !== "object" || Object.values(result.serviceStatusList).some(v => typeof v !== "string")) throw new BridgeError("unsupported", "Service response does not match official Dockge 1.5.0; review the configured profile.");
    return { ...input, services: result.serviceStatusList, observed_at: new Date().toISOString(), readiness: "unknown",
      limitation: "Dockge may return an empty result when Docker ps fails and may omit stopped services." };
  }
  mutate(tool: string, input: MutationInput) {
    if (this.closing) throw new BridgeError("unavailable", "Bridge is shutting down before dispatch.");
    this.permission(tool); this.validateTarget(input);
    if (input.env_content !== undefined && tool !== "set_stack_env") throw new BridgeError("invalid_input", "Environment content is accepted only by set_stack_env.");
    if (input.compose_yaml !== undefined) {
      if (Buffer.byteLength(input.compose_yaml) > this.config.maxBytes / 2) throw new BridgeError("invalid_input", "Compose document exceeds 512 KiB.");
      try { parse(input.compose_yaml); } catch { throw new BridgeError("invalid_input", "Compose document is invalid YAML."); }
    }
    if (input.env_content !== undefined && Buffer.byteLength(input.env_content) > this.config.maxBytes / 2) throw new BridgeError("invalid_input", "Environment document exceeds 512 KiB.");
    const operation = this.ledger.accept(input.agent_id, input.stack_name, tool);
    // Defer preflight/dispatch; clients always receive their operation handle first.
    const task = Promise.resolve().then(() => this.run(operation, input)).finally(() => this.tasks.delete(task));
    this.tasks.add(task);
    return this.ledger.public(operation);
  }
  private async run(operation: Operation, input: MutationInput) {
    const id = operation.operation_id, tool = operation.tool;
    let dispatched = false;
    let outputListener: ((name: string, data: string) => void) | undefined;
    try {
      let before: StackDocument | undefined;
      if (tool === "create_stack") {
        const list = await this.dockge.stacks(input.agent_id);
        if (list[input.stack_name]) throw new BridgeError("conflict", "Stack name already exists.");
      } else {
        before = await this.dockge.document(input.agent_id, input.stack_name);
        if (before.isManagedByDockge !== true) throw new BridgeError("unsupported", "This operation requires a stack managed by Dockge.");
        const current = this.revisions(input, before);
        if (["edit_stack", "deploy_stack"].includes(tool) && input.expected_revision !== current.revision) throw new BridgeError("conflict", "Compose revision changed; read current YAML before retrying.");
        if (tool === "set_stack_env" && input.expected_env_revision !== current.env_revision) throw new BridgeError("conflict", "Environment revision changed; obtain fresh metadata before retrying.");
      }
      let event: string, args: unknown[];
      let expectedYAML: string | undefined, expectedENV: string | undefined;
      if (["create_stack", "edit_stack", "set_stack_env", "deploy_stack"].includes(tool)) {
        expectedYAML = tool === "create_stack" || tool === "edit_stack" ? input.compose_yaml! : before!.composeYAML;
        expectedENV = tool === "create_stack" ? "" : tool === "set_stack_env" ? input.env_content! : before!.composeENV;
        event = tool === "deploy_stack" ? "deployStack" : "saveStack";
        args = [input.stack_name, expectedYAML, expectedENV, tool === "create_stack"];
      } else {
        event = wireEvents[tool]; args = [input.stack_name];
        if (!event) throw new BridgeError("unsupported", "Operation is not supported by the configured release profile.");
      }
      // Suppress configuration command output: Compose errors can expand environment values.
      // For lifecycle commands remove known credential/environment values before persistence.
      const secrets = [this.config.password, this.config.jwt, this.config.bearer,
        ...(before?.composeENV ?? "").split("\n").map(line => line.match(/^[^#=]+=(.*)$/)?.[1]?.trim().replace(/^['"]|['"]$/g, ""))].filter((v): v is string => !!v);
      if (!expectedYAML) {
        const terminal = this.dockge.terminalName(input.agent_id, input.stack_name);
        // Accumulate until completion, then redact across chunk boundaries before persistence.
        let raw = "";
        outputListener = (name, data) => { if (name === terminal) raw = (raw + data).slice(-this.config.logBytes * 2); };
        this.dockge.on("terminal", outputListener);
        const persist = () => { let text = raw; for (const secret of secrets) text = text.split(secret).join("[REDACTED]"); this.ledger.append(id, text); };
        (outputListener as typeof outputListener & { persist?: () => void }).persist = persist;
      }
      this.dockge.target(input.agent_id);
      this.ledger.state(id, "running");
      dispatched = true;
      await this.dockge.call(input.agent_id, event, args, true);
      if (expectedYAML !== undefined) {
        const after = await this.dockge.document(input.agent_id, input.stack_name);
        if (after.composeYAML !== expectedYAML || after.composeENV !== expectedENV) throw new BridgeError("unknown", "Dockge acknowledged the save but verification differs; a partial write, incompatible build, or external edit may have occurred.", true);
      }
      this.ledger.state(id, "succeeded");
    } catch (error) {
      const safe = safeError(error);
      const uncertain = dispatched && (safe.code === "unknown" || safe.code === "unavailable" || safe.code === "unsupported");
      this.ledger.state(id, uncertain ? "unknown" : "failed", uncertain ? { code: "unknown", message: "Outcome could not be verified after dispatch; inspect Dockge before resolving the operation. No automatic replay." } : safe);
    } finally {
      if (outputListener) {
        this.dockge.off("terminal", outputListener);
        (outputListener as typeof outputListener & { persist?: () => void }).persist?.();
      }
      if (["start_stack", "deploy_stack"].includes(tool)) await this.dockge.detachOperationLogs(input.agent_id, input.stack_name);
    }
  }
  operation(id: string, logs = false) {
    const row = this.ledger.get(id);
    // Environment writes have a separate permission and never retain content/output.
    if (row.tool === "set_stack_env" && !this.config.permissions.envWrite) throw new BridgeError("forbidden", "Environment-write operation access is disabled.");
    if (this.config.allowedAgents.length && !this.config.allowedAgents.includes(row.agent_id)) throw new BridgeError("forbidden", "Operation target is outside the configured allowlist.");
    return logs ? { operation_id: id, text: row.logs, truncated: !!row.truncated, retention_hours: 24 } : this.ledger.public(row);
  }
  resolve(id: string, reason: string) {
    const row = this.ledger.get(id); this.permission(row.tool); this.operation(id);
    return this.ledger.resolve(id, reason);
  }
  async close() { this.closing = true; this.dockge.close(); await Promise.allSettled([...this.tasks]); this.ledger.close(); }
}
