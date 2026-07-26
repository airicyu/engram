/** Runtime configuration from env + optional `{ENGRAM_HOME}/engram.workspace.yaml`. */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "./yaml";

const repoRoot = resolve(import.meta.dir, "../..");

/** IANA timezone for calendar days and event timestamps. */
export const DEFAULT_TIMEZONE = "Asia/Hong_Kong";

/** Allowed memory write languages (exact match). */
export const MEMORY_LANGUAGES = ["zh-Hant", "zh-Hans", "en"] as const;
export type MemoryLanguage = (typeof MEMORY_LANGUAGES)[number];

export const DEFAULT_MEMORY_LANGUAGE: MemoryLanguage = "en";

const WORKSPACE_KEYS = new Set(["timezone", "memory_language"]);

function failWorkspace(message: string): never {
  console.error(`engram workspace config: ${message}`);
  process.exit(1);
}

/** True if `tz` is a valid IANA time zone id. */
export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isMemoryLanguage(value: unknown): value is MemoryLanguage {
  return typeof value === "string" && (MEMORY_LANGUAGES as readonly string[]).includes(value);
}

type WorkspaceFile = {
  timezone?: string;
  memory_language?: MemoryLanguage;
};

function loadWorkspaceFile(engramHome: string): WorkspaceFile | null {
  const path = join(engramHome, "engram.workspace.yaml");
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    failWorkspace(`cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (e) {
    failWorkspace(`invalid YAML in ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    failWorkspace(`${path} must be a YAML mapping`);
  }

  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!WORKSPACE_KEYS.has(key)) {
      failWorkspace(`${path}: unknown key "${key}" (allowed: timezone, memory_language)`);
    }
  }

  const out: WorkspaceFile = {};

  if ("timezone" in obj) {
    const tz = obj.timezone;
    if (typeof tz !== "string" || !tz.trim()) {
      failWorkspace(`${path}: timezone must be a non-empty IANA string`);
    }
    const trimmed = tz.trim();
    if (!isValidIanaTimezone(trimmed)) {
      failWorkspace(`${path}: invalid IANA timezone "${trimmed}"`);
    }
    out.timezone = trimmed;
  }

  if ("memory_language" in obj) {
    const lang = obj.memory_language;
    if (!isMemoryLanguage(lang)) {
      failWorkspace(
        `${path}: memory_language must be one of ${MEMORY_LANGUAGES.join(" | ")} (got ${JSON.stringify(lang)})`,
      );
    }
    out.memory_language = lang;
  }

  return out;
}

function resolveMemoryLanguage(
  workspace: WorkspaceFile | null,
): MemoryLanguage {
  if (workspace?.memory_language) return workspace.memory_language;
  const fromEnv = process.env.ENGRAM_MEMORY_LANGUAGE?.trim();
  if (fromEnv) {
    if (!isMemoryLanguage(fromEnv)) {
      failWorkspace(
        `ENGRAM_MEMORY_LANGUAGE must be one of ${MEMORY_LANGUAGES.join(" | ")} (got ${JSON.stringify(fromEnv)})`,
      );
    }
    return fromEnv;
  }
  return DEFAULT_MEMORY_LANGUAGE;
}

function resolveTimezone(workspace: WorkspaceFile | null): string {
  if (workspace?.timezone) return workspace.timezone;
  const fromEnv = process.env.ENGRAM_TZ?.trim();
  if (fromEnv) {
    if (!isValidIanaTimezone(fromEnv)) {
      failWorkspace(`ENGRAM_TZ invalid IANA timezone "${fromEnv}"`);
    }
    return fromEnv;
  }
  return DEFAULT_TIMEZONE;
}

const engramHome = resolve(process.env.ENGRAM_HOME ?? resolve(repoRoot, "data"));
const workspace = loadWorkspaceFile(engramHome);

/** Resolved server port, storage home, agent binaries, timezone, memory language. */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  engramHome,
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  cursorAgentBin: process.env.CURSOR_AGENT_BIN ?? "agent",
  timezone: resolveTimezone(workspace),
  /** Effective write language for chain／node／ask (always one of MEMORY_LANGUAGES). */
  memoryLanguage: resolveMemoryLanguage(workspace),
  /** When true, PUT /clock may set a virtual memory timeline. */
  allowVirtualClock: process.env.ENGRAM_ALLOW_VIRTUAL_CLOCK === "1",
};
