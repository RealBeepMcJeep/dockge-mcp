import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { BridgeError, bounded } from "./core.js";

export type OperationState = "accepted" | "running" | "succeeded" | "failed" | "unknown" | "resolved";
export type Operation = {
  operation_id: string; agent_id: string; stack_name: string; tool: string; state: OperationState;
  created_at: number; updated_at: number; error_code: string | null; message: string | null;
  logs: string; truncated: number; resolution_reason: string | null;
};
export class Ledger {
  readonly db: Database;
  readonly secret: string;
  constructor(dir: string, readonly logBytes = 65536, readonly now = () => Date.now()) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new Database(join(dir, "operations.sqlite"), { create: true, strict: true });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations (
        operation_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, stack_name TEXT NOT NULL, tool TEXT NOT NULL,
        state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        error_code TEXT, message TEXT, logs TEXT NOT NULL DEFAULT '', truncated INTEGER NOT NULL DEFAULT 0, resolution_reason TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS stack_guard ON operations(agent_id,stack_name) WHERE state IN ('accepted','running','unknown');`);
    this.db.query("INSERT OR IGNORE INTO settings VALUES ('revision_secret', ?)").run(randomBytes(32).toString("hex"));
    this.secret = (this.db.query("SELECT value FROM settings WHERE key='revision_secret'").get() as { value: string }).value;
    this.db.query("UPDATE operations SET state='unknown', error_code='unknown', message='Bridge restarted after dispatch; inspect Dockge and explicitly resolve before another mutation.', updated_at=? WHERE state='running'").run(this.now());
    this.db.query("UPDATE operations SET state='failed', error_code='unavailable', message='Bridge restarted before dispatch; operation was not replayed.', updated_at=? WHERE state='accepted'").run(this.now());
    this.prune();
  }
  prune() {
    const cutoff = this.now() - 86400000;
    this.db.query("UPDATE operations SET logs='' WHERE updated_at < ? AND logs <> ''").run(cutoff);
    this.db.query("DELETE FROM operations WHERE state IN ('succeeded','failed','resolved') AND updated_at < ?").run(cutoff);
    this.db.exec("DELETE FROM operations WHERE state IN ('succeeded','failed','resolved') AND operation_id NOT IN (SELECT operation_id FROM operations ORDER BY updated_at DESC LIMIT 5000)");
  }
  accept(agent: string, stack: string, tool: string): Operation {
    this.prune();
    if (this.db.query("SELECT operation_id FROM operations WHERE agent_id=? AND stack_name=? AND state IN ('accepted','running','unknown')").get(agent, stack)) throw new BridgeError("busy", "Stack has an active or unknown operation; inspect operation_status and resolve unknown operations explicitly.");
    const active = this.db.query("SELECT count(*) AS n FROM operations WHERE state IN ('accepted','running','unknown')").get() as { n: number };
    if (active.n >= 256) throw new BridgeError("busy", "Bridge operation capacity reached; resolve outstanding operations.");
    const id = randomUUID(), time = this.now();
    this.db.query("INSERT INTO operations (operation_id,agent_id,stack_name,tool,state,created_at,updated_at) VALUES (?,?,?,?,'accepted',?,?)").run(id, agent, stack, tool, time, time);
    return this.get(id);
  }
  get(id: string): Operation {
    this.prune();
    const row = this.db.query("SELECT * FROM operations WHERE operation_id=?").get(id) as Operation | null;
    if (!row) throw new BridgeError("not_found", "Operation not found or resolved history has expired.");
    return row;
  }
  listUnresolved() {
    return (this.db.query("SELECT * FROM operations WHERE state IN ('accepted','running','unknown') ORDER BY created_at").all() as Operation[]).map(row => this.public(row));
  }
  public(row: Operation) {
    const { logs: _logs, truncated: _truncated, ...result } = row;
    return { ...result, created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString(),
      completion_means: "Dockge command completion; application readiness is not established." };
  }
  state(id: string, state: OperationState, error?: { code: string; message: string }) {
    this.db.query("UPDATE operations SET state=?, error_code=?, message=?, updated_at=? WHERE operation_id=?").run(state, error?.code ?? null, error?.message ?? null, this.now(), id);
  }
  append(id: string, text: string) {
    const row = this.get(id), result = bounded(row.logs + text, this.logBytes);
    this.db.query("UPDATE operations SET logs=?,truncated=?,updated_at=? WHERE operation_id=?").run(result.text, Number(result.truncated || row.truncated), this.now(), id);
  }
  resolve(id: string, reason: string) {
    const row = this.get(id);
    if (row.state !== "unknown") throw new BridgeError("conflict", "Only an unknown operation can be explicitly resolved.");
    this.db.query("UPDATE operations SET state='resolved',resolution_reason=?,updated_at=? WHERE operation_id=?").run(reason, this.now(), id);
    return this.public(this.get(id));
  }
  close() { this.db.close(); }
}
