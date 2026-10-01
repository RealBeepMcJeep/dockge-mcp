import { createHmac, timingSafeEqual } from "node:crypto";

export type ErrorCode = "invalid_input" | "forbidden" | "unsupported" | "unavailable" | "busy" | "conflict" | "command_failed" | "unknown" | "not_found";
export class BridgeError extends Error {
  constructor(public code: ErrorCode, message: string, public dispatched = false) { super(message); }
}
export function safeError(error: unknown): { code: ErrorCode; message: string } {
  return error instanceof BridgeError ? { code: error.code, message: error.message } : { code: "unknown", message: "Unexpected bridge error; inspect bridge availability and operation state." };
}
export function bounded(value: string, bytes: number): { text: string; truncated: boolean } {
  const buffer = Buffer.from(value);
  let start = Math.max(0, buffer.length - bytes);
  // Do not turn a sliced UTF-8 continuation byte into a larger replacement character.
  while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start++;
  return { text: buffer.subarray(start).toString("utf8"), truncated: buffer.length > bytes };
}
export function revision(secret: string, target: string, kind: string, value: string): string {
  return createHmac("sha256", secret).update(JSON.stringify([target, kind, value])).digest("hex");
}
export function equalSecret(a: string, b: string): boolean {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export type Permissions = { write: boolean; delete: boolean; envRead: boolean; envWrite: boolean };
export type Config = {
  dockgeUrl: string; username?: string; password?: string; jwt?: string;
  bearer: string; host: string; port: number; allowedHosts: string[]; allowedOrigins: string[];
  allowedAgents: string[]; permissions: Permissions; stateDir: string; profile: "1.5.0";
  readTimeoutMs: number; mutationTimeoutMs: number; maxBytes: number; logBytes: number;
};
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const required = (key: string) => { const value = env[key]; if (!value) throw new Error(`Missing ${key}`); return value; };
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  const bool = (key: string) => { if (env[key] && !["true", "false"].includes(env[key]!)) throw new Error(`Invalid ${key}`); return env[key] === "true"; };
  const list = (key: string, fallback = "") => (env[key] ?? fallback).split(",").map(s => s.trim()).filter(Boolean);
  const dockgeUrl = required("DOCKGE_URL");
  const url = new URL(dockgeUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("DOCKGE_URL must be an HTTP(S) URL without credentials, query, or fragment");
  const bearer = required("MCP_BEARER_TOKEN");
  if (bearer.length < 32) throw new Error("MCP_BEARER_TOKEN must contain at least 32 characters");
  if (!env.DOCKGE_JWT && !(env.DOCKGE_USERNAME && env.DOCKGE_PASSWORD)) throw new Error("Configure DOCKGE_JWT or DOCKGE_USERNAME and DOCKGE_PASSWORD");
  if ((env.DOCKGE_PROFILE ?? "1.5.0") !== "1.5.0") throw new Error("Unsupported DOCKGE_PROFILE; only official release 1.5.0 is supported");
  const port = number("PORT", 3000, 1, 65535);
  return {
    dockgeUrl, username: env.DOCKGE_USERNAME, password: env.DOCKGE_PASSWORD, jwt: env.DOCKGE_JWT,
    bearer, host: env.HOST ?? "0.0.0.0", port,
    allowedHosts: list("MCP_ALLOWED_HOSTS", `localhost:${port},127.0.0.1:${port}`), allowedOrigins: list("MCP_ALLOWED_ORIGINS"),
    allowedAgents: list("DOCKGE_ALLOWED_AGENTS"),
    permissions: { write: bool("DOCKGE_ALLOW_WRITE"), delete: bool("DOCKGE_ALLOW_DELETE"), envRead: bool("DOCKGE_ALLOW_ENV_READ"), envWrite: bool("DOCKGE_ALLOW_ENV_WRITE") },
    stateDir: env.STATE_DIR ?? "./data", profile: "1.5.0",
    readTimeoutMs: number("DOCKGE_READ_TIMEOUT_MS", 10000, 100, 60000),
    mutationTimeoutMs: number("DOCKGE_MUTATION_TIMEOUT_MS", 120000, 100, 1800000),
    maxBytes: 1024 * 1024, logBytes: 64 * 1024,
  };
}
