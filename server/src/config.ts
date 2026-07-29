/** Runtime configuration from env + optional `{ENGRAM_STORE_DIR}/engram.workspace.yaml`. */

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

const WORKSPACE_KEYS = new Set(["timezone", "memory_language", "store_version"]);

/** Semver X.Y.Z (no prerelease／build). */
const STORE_VERSION_RE = /^\d+\.\d+\.\d+$/;

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

export function isStoreVersion(value: unknown): value is string {
  return typeof value === "string" && STORE_VERSION_RE.test(value.trim());
}

/** Read product version from repo `version.md` (first non-empty line). */
export function readProductVersion(root = repoRoot): string {
  const path = join(root, "version.md");
  try {
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (line && STORE_VERSION_RE.test(line)) return line;
  } catch {
    /* fall through */
  }
  return "0.0.0";
}

type WorkspaceFile = {
  timezone?: string;
  memory_language?: MemoryLanguage;
  store_version?: string;
};

function loadWorkspaceFile(storeDir: string): WorkspaceFile | null {
  const path = join(storeDir, "engram.workspace.yaml");
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
      failWorkspace(
        `${path}: unknown key "${key}" (allowed: timezone, memory_language, store_version)`,
      );
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

  if ("store_version" in obj) {
    const ver = obj.store_version;
    if (!isStoreVersion(ver)) {
      failWorkspace(
        `${path}: store_version must be semver X.Y.Z (got ${JSON.stringify(ver)})`,
      );
    }
    out.store_version = ver.trim();
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

const storeDir = resolve(process.env.ENGRAM_STORE_DIR ?? resolve(repoRoot, "data"));
const workspace = loadWorkspaceFile(storeDir);
const productVersion = readProductVersion();

/**
 * Re-read `store_version` from disk (valid X.Y.Z or null).
 * Does not refuse on missing; invalid → null here (startup already validated if key was present at boot).
 */
export function peekStoreVersion(dir = storeDir): string | null {
  const path = join(dir, "engram.workspace.yaml");
  if (!existsSync(path)) return null;
  try {
    const parsed = parseYaml(readFileSync(path, "utf8"));
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (!("store_version" in parsed)) return null;
    const ver = (parsed as Record<string, unknown>).store_version;
    return isStoreVersion(ver) ? ver.trim() : null;
  } catch {
    return null;
  }
}

function resolveTempDir(): string {
  const raw = (process.env.ENGRAM_TEMP_DIR ?? "/tmp").trim() || "/tmp";
  return resolve(raw);
}

/** Resolved server port, storage home, agent binaries, timezone, memory language. */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  storeDir,
  /** Host temp root for ask jobs + dream agent workdirs (not inside the memory store). */
  tempDir: resolveTempDir(),
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  cursorAgentBin: process.env.CURSOR_AGENT_BIN ?? "agent",
  timezone: resolveTimezone(workspace),
  /** Effective write language for chain／node／ask (always one of MEMORY_LANGUAGES). */
  memoryLanguage: resolveMemoryLanguage(workspace),
  /**
   * Disk structure generation from workspace `store_version` at process start, or null if unset.
   * Prefer {@link peekStoreVersion} for live status (file may be stamped after boot).
   */
  storeVersion: workspace?.store_version ?? null,
  /** Engram product version (`version.md`). */
  productVersion,
  /** When true, PUT /clock may set a virtual memory timeline. */
  allowVirtualClock: process.env.ENGRAM_ALLOW_VIRTUAL_CLOCK === "1",
};
