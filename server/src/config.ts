/** Runtime configuration from env + optional `{ENGRAM_STORE_DIR}/engram.workspace.yaml`. */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "./yaml";
import { loadEngramRootEnv } from "./load-root-env";

const repoRoot = loadEngramRootEnv();

/** IANA timezone for calendar days and event timestamps. */
export const DEFAULT_TIMEZONE = "Asia/Hong_Kong";

/** Allowed memory write languages (exact match). */
export const MEMORY_LANGUAGES = ["zh-Hant", "zh-Hans", "en"] as const;
export type MemoryLanguage = (typeof MEMORY_LANGUAGES)[number];

export const DEFAULT_MEMORY_LANGUAGE: MemoryLanguage = "en";

/** Prompt-facing write-language instruction. JSON／API still use the bare code. */
export const MEMORY_LANGUAGE_PROMPT_LABEL: Record<MemoryLanguage, string> = {
  "zh-Hant":
    "zh-Hant — Traditional Chinese written style (繁體中文書面語); not spoken Cantonese, not internet slang",
  "zh-Hans":
    "zh-Hans — Simplified Chinese written style (简体中文书面语); not internet slang",
  en: "en — English",
};

export function memoryLanguagePromptLabel(lang: string): string {
  if (isMemoryLanguage(lang)) return MEMORY_LANGUAGE_PROMPT_LABEL[lang];
  return lang;
}

const WORKSPACE_KEYS = new Set([
  "timezone",
  "memory_language",
  "store_version",
  "future_sight_window_days",
  "future_sight_upcoming_days",
  "dream_staging_retention_days",
  "dream_committed_report_retention_days",
  "dream_cleanup_min_age_days",
  "dream_cleanup_cron",
  "dream_cleanup_cron_enabled",
  "dream_cleanup_on_start",
  "auto_dream_enabled",
  "auto_dream_cron",
  "dream_auto_approve",
  "port",
  "temp_dir",
  "agent",
  "claude_bin",
  "cursor_agent_bin",
  "cursor_sandbox",
  "codex_bin",
  "allow_virtual_clock",
  "allow_stale_store",
  "dream_debug",
  "memory_debug",
  "attachment_max_bytes",
  "attachment_tmp_retention_days",
  "attachment_housekeep_cron",
  "attachment_housekeep_cron_enabled",
  "attachment_housekeep_on_start",
]);

export const DEFAULT_FUTURE_SIGHT_WINDOW_DAYS = 365;
export const DEFAULT_FUTURE_SIGHT_UPCOMING_DAYS = 30;
export const DEFAULT_DREAM_STAGING_RETENTION_DAYS = 3;
export const DEFAULT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
export const DEFAULT_ATTACHMENT_TMP_RETENTION_DAYS = 2;
export const DEFAULT_ATTACHMENT_HOUSEKEEP_CRON = "30 2 * * *";
export const DEFAULT_DREAM_COMMITTED_REPORT_RETENTION_DAYS = 7;
export const DEFAULT_DREAM_CLEANUP_MIN_AGE_DAYS = 1;
export const DEFAULT_DREAM_CLEANUP_CRON = "10 0 * * *";
export const DEFAULT_AUTO_DREAM_CRON = "30 0 * * *";

/** Valid `ENGRAM_AGENT` / workspace `agent` values. */
export const AGENT_MODES = [
  "claude",
  "cursor",
  "codex",
  "mock-ok",
  "mock-fail",
  "mock-bad-involvement",
  "mock-empty-patches",
  "mock-malicious-live",
  "mock-ask-ok",
  "mock-ask-malicious-live",
] as const;

export type AgentMode = (typeof AGENT_MODES)[number];

const AGENT_MODE_SET = new Set<string>(AGENT_MODES);

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
  future_sight_window_days?: number;
  future_sight_upcoming_days?: number;
  dream_staging_retention_days?: number;
  dream_committed_report_retention_days?: number;
  dream_cleanup_min_age_days?: number;
  dream_cleanup_cron?: string;
  dream_cleanup_cron_enabled?: boolean;
  dream_cleanup_on_start?: boolean;
  auto_dream_enabled?: boolean;
  auto_dream_cron?: string;
  dream_auto_approve?: boolean;
  port?: number;
  temp_dir?: string;
  agent?: AgentMode;
  claude_bin?: string;
  cursor_agent_bin?: string;
  cursor_sandbox?: "enabled" | "disabled";
  codex_bin?: string;
  allow_virtual_clock?: boolean;
  allow_stale_store?: boolean;
  dream_debug?: boolean;
  memory_debug?: boolean;
  attachment_max_bytes?: number;
  attachment_tmp_retention_days?: number;
  attachment_housekeep_cron?: string;
  attachment_housekeep_cron_enabled?: boolean;
  attachment_housekeep_on_start?: boolean;
};

/** Positive integer day-count (future-sight windows). */
export function isPositiveIntDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parsePositiveIntDays(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    failWorkspace(`${label} must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return n;
}

function isNonNegativeIntDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseNonNegativeIntDays(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    failWorkspace(`${label} must be a non-negative integer (got ${JSON.stringify(raw)})`);
  }
  return n;
}

function isCommittedReportRetentionDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && (value === -1 || value >= 1);
}

function parseCommittedReportRetentionDays(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || (n !== -1 && n < 1)) {
    failWorkspace(`${label} must be -1 or an integer >= 1 (got ${JSON.stringify(raw)})`);
  }
  return n;
}

function isWorkspaceBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function resolveEnvBoolean(envVal: string | undefined, defaultValue: boolean): boolean {
  if (envVal === undefined || envVal === "") return defaultValue;
  const v = envVal.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  failWorkspace(`boolean env must be 0/1/true/false (got ${JSON.stringify(envVal)})`);
}

function isCronExpression(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const parts = value.trim().split(/\s+/);
  return parts.length === 5;
}

function parseCronExpression(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!isCronExpression(trimmed)) {
    failWorkspace(`${label} must be a 5-field cron expression (got ${JSON.stringify(raw)})`);
  }
  return trimmed;
}

function isAgentMode(value: unknown): value is AgentMode {
  return typeof value === "string" && AGENT_MODE_SET.has(value);
}

function parseAgentMode(raw: string, label: string): AgentMode {
  const mode = raw.trim();
  if (!isAgentMode(mode)) {
    failWorkspace(
      `${label} must be one of ${AGENT_MODES.join(" | ")} (got ${JSON.stringify(raw)})`,
    );
  }
  return mode;
}

function isCursorSandbox(value: unknown): value is "enabled" | "disabled" {
  return value === "enabled" || value === "disabled";
}

/** workspace key present → workspace; else env; else default */
function pickConfig<T>(workspaceVal: T | undefined, envVal: T | undefined, defaultVal: T): T {
  if (workspaceVal !== undefined) return workspaceVal;
  if (envVal !== undefined) return envVal;
  return defaultVal;
}

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
        `${path}: unknown key "${key}" (allowed: ${[...WORKSPACE_KEYS].sort().join(", ")})`,
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

  if ("future_sight_window_days" in obj) {
    const v = obj.future_sight_window_days;
    if (!isPositiveIntDays(v)) {
      failWorkspace(
        `${path}: future_sight_window_days must be a positive integer (got ${JSON.stringify(v)})`,
      );
    }
    out.future_sight_window_days = v;
  }

  if ("future_sight_upcoming_days" in obj) {
    const v = obj.future_sight_upcoming_days;
    if (!isPositiveIntDays(v)) {
      failWorkspace(
        `${path}: future_sight_upcoming_days must be a positive integer (got ${JSON.stringify(v)})`,
      );
    }
    out.future_sight_upcoming_days = v;
  }

  if ("dream_staging_retention_days" in obj) {
    const v = obj.dream_staging_retention_days;
    if (!isNonNegativeIntDays(v)) {
      failWorkspace(
        `${path}: dream_staging_retention_days must be a non-negative integer (got ${JSON.stringify(v)})`,
      );
    }
    out.dream_staging_retention_days = v;
  }

  if ("dream_committed_report_retention_days" in obj) {
    const v = obj.dream_committed_report_retention_days;
    if (!isCommittedReportRetentionDays(v)) {
      failWorkspace(
        `${path}: dream_committed_report_retention_days must be -1 or an integer >= 1 (got ${JSON.stringify(v)})`,
      );
    }
    out.dream_committed_report_retention_days = v;
  }

  if ("dream_cleanup_min_age_days" in obj) {
    const v = obj.dream_cleanup_min_age_days;
    if (!isNonNegativeIntDays(v)) {
      failWorkspace(
        `${path}: dream_cleanup_min_age_days must be a non-negative integer (got ${JSON.stringify(v)})`,
      );
    }
    out.dream_cleanup_min_age_days = v;
  }

  if ("dream_cleanup_cron" in obj) {
    const v = obj.dream_cleanup_cron;
    if (!isCronExpression(v)) {
      failWorkspace(`${path}: dream_cleanup_cron must be a 5-field cron string`);
    }
    out.dream_cleanup_cron = v.trim();
  }

  if ("dream_cleanup_cron_enabled" in obj) {
    const v = obj.dream_cleanup_cron_enabled;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: dream_cleanup_cron_enabled must be boolean`);
    }
    out.dream_cleanup_cron_enabled = v;
  }

  if ("dream_cleanup_on_start" in obj) {
    const v = obj.dream_cleanup_on_start;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: dream_cleanup_on_start must be boolean`);
    }
    out.dream_cleanup_on_start = v;
  }

  if ("auto_dream_enabled" in obj) {
    const v = obj.auto_dream_enabled;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: auto_dream_enabled must be boolean`);
    }
    out.auto_dream_enabled = v;
  }

  if ("auto_dream_cron" in obj) {
    const v = obj.auto_dream_cron;
    if (!isCronExpression(v)) {
      failWorkspace(`${path}: auto_dream_cron must be a 5-field cron string`);
    }
    out.auto_dream_cron = v.trim();
  }

  if ("dream_auto_approve" in obj) {
    const v = obj.dream_auto_approve;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: dream_auto_approve must be boolean`);
    }
    out.dream_auto_approve = v;
  }

  if ("port" in obj) {
    const v = obj.port;
    if (!isPositiveIntDays(v)) {
      failWorkspace(`${path}: port must be a positive integer (got ${JSON.stringify(v)})`);
    }
    out.port = v;
  }

  if ("temp_dir" in obj) {
    const v = obj.temp_dir;
    if (typeof v !== "string" || !v.trim()) {
      failWorkspace(`${path}: temp_dir must be a non-empty string`);
    }
    out.temp_dir = v.trim();
  }

  if ("agent" in obj) {
    const v = obj.agent;
    if (!isAgentMode(v)) {
      failWorkspace(
        `${path}: agent must be one of ${AGENT_MODES.join(" | ")} (got ${JSON.stringify(v)})`,
      );
    }
    out.agent = v;
  }

  if ("claude_bin" in obj) {
    const v = obj.claude_bin;
    if (typeof v !== "string" || !v.trim()) {
      failWorkspace(`${path}: claude_bin must be a non-empty string`);
    }
    out.claude_bin = v.trim();
  }

  if ("cursor_agent_bin" in obj) {
    const v = obj.cursor_agent_bin;
    if (typeof v !== "string" || !v.trim()) {
      failWorkspace(`${path}: cursor_agent_bin must be a non-empty string`);
    }
    out.cursor_agent_bin = v.trim();
  }

  if ("cursor_sandbox" in obj) {
    const v = obj.cursor_sandbox;
    if (!isCursorSandbox(v)) {
      failWorkspace(`${path}: cursor_sandbox must be enabled or disabled`);
    }
    out.cursor_sandbox = v;
  }

  if ("codex_bin" in obj) {
    const v = obj.codex_bin;
    if (typeof v !== "string" || !v.trim()) {
      failWorkspace(`${path}: codex_bin must be a non-empty string`);
    }
    out.codex_bin = v.trim();
  }

  if ("allow_virtual_clock" in obj) {
    const v = obj.allow_virtual_clock;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: allow_virtual_clock must be boolean`);
    }
    out.allow_virtual_clock = v;
  }

  if ("allow_stale_store" in obj) {
    const v = obj.allow_stale_store;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: allow_stale_store must be boolean`);
    }
    out.allow_stale_store = v;
  }

  if ("dream_debug" in obj) {
    const v = obj.dream_debug;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: dream_debug must be boolean`);
    }
    out.dream_debug = v;
  }

  if ("memory_debug" in obj) {
    const v = obj.memory_debug;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: memory_debug must be boolean`);
    }
    out.memory_debug = v;
  }

  if ("attachment_max_bytes" in obj) {
    const v = obj.attachment_max_bytes;
    if (!isPositiveIntDays(v)) {
      failWorkspace(
        `${path}: attachment_max_bytes must be a positive integer (got ${JSON.stringify(v)})`,
      );
    }
    out.attachment_max_bytes = v;
  }

  if ("attachment_tmp_retention_days" in obj) {
    const v = obj.attachment_tmp_retention_days;
    if (!isNonNegativeIntDays(v)) {
      failWorkspace(
        `${path}: attachment_tmp_retention_days must be a non-negative integer (got ${JSON.stringify(v)})`,
      );
    }
    out.attachment_tmp_retention_days = v;
  }

  if ("attachment_housekeep_cron" in obj) {
    const v = obj.attachment_housekeep_cron;
    if (!isCronExpression(v)) {
      failWorkspace(`${path}: attachment_housekeep_cron must be a 5-field cron string`);
    }
    out.attachment_housekeep_cron = v.trim();
  }

  if ("attachment_housekeep_cron_enabled" in obj) {
    const v = obj.attachment_housekeep_cron_enabled;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: attachment_housekeep_cron_enabled must be boolean`);
    }
    out.attachment_housekeep_cron_enabled = v;
  }

  if ("attachment_housekeep_on_start" in obj) {
    const v = obj.attachment_housekeep_on_start;
    if (!isWorkspaceBoolean(v)) {
      failWorkspace(`${path}: attachment_housekeep_on_start must be boolean`);
    }
    out.attachment_housekeep_on_start = v;
  }

  return out;
}

function resolveFutureSightWindowDays(workspace: WorkspaceFile | null): number {
  if (workspace?.future_sight_window_days != null) return workspace.future_sight_window_days;
  const fromEnv = process.env.ENGRAM_FUTURE_SIGHT_WINDOW_DAYS?.trim();
  if (fromEnv) {
    return parsePositiveIntDays(fromEnv, "ENGRAM_FUTURE_SIGHT_WINDOW_DAYS");
  }
  return DEFAULT_FUTURE_SIGHT_WINDOW_DAYS;
}

function resolveFutureSightUpcomingDays(workspace: WorkspaceFile | null): number {
  if (workspace?.future_sight_upcoming_days != null) return workspace.future_sight_upcoming_days;
  const fromEnv = process.env.ENGRAM_FUTURE_SIGHT_UPCOMING_DAYS?.trim();
  if (fromEnv) {
    return parsePositiveIntDays(fromEnv, "ENGRAM_FUTURE_SIGHT_UPCOMING_DAYS");
  }
  return DEFAULT_FUTURE_SIGHT_UPCOMING_DAYS;
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

function resolveDreamStagingRetentionDays(workspace: WorkspaceFile | null): number {
  if (workspace?.dream_staging_retention_days != null) {
    return workspace.dream_staging_retention_days;
  }
  const fromEnv =
    process.env.ENGRAM_DREAM_STAGING_RETENTION_DAYS?.trim() ??
    process.env.ENGRAM_DREAM_ARTIFACT_RETENTION_DAYS?.trim();
  if (fromEnv !== undefined && fromEnv !== "") {
    return parseNonNegativeIntDays(fromEnv, "ENGRAM_DREAM_STAGING_RETENTION_DAYS");
  }
  return DEFAULT_DREAM_STAGING_RETENTION_DAYS;
}

function resolveDreamCommittedReportRetentionDays(workspace: WorkspaceFile | null): number {
  if (workspace?.dream_committed_report_retention_days != null) {
    return workspace.dream_committed_report_retention_days;
  }
  const fromEnv = process.env.ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS?.trim();
  if (fromEnv !== undefined && fromEnv !== "") {
    return parseCommittedReportRetentionDays(fromEnv, "ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS");
  }
  return DEFAULT_DREAM_COMMITTED_REPORT_RETENTION_DAYS;
}

function resolveDreamCleanupMinAgeDays(workspace: WorkspaceFile | null): number {
  if (workspace?.dream_cleanup_min_age_days != null) return workspace.dream_cleanup_min_age_days;
  const fromEnv = process.env.ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS?.trim();
  if (fromEnv !== undefined && fromEnv !== "") {
    return parseNonNegativeIntDays(fromEnv, "ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS");
  }
  return DEFAULT_DREAM_CLEANUP_MIN_AGE_DAYS;
}

function resolveDreamCleanupCron(workspace: WorkspaceFile | null): string {
  if (workspace?.dream_cleanup_cron) return workspace.dream_cleanup_cron;
  const fromEnv = process.env.ENGRAM_DREAM_CLEANUP_CRON?.trim();
  if (fromEnv) return parseCronExpression(fromEnv, "ENGRAM_DREAM_CLEANUP_CRON");
  return DEFAULT_DREAM_CLEANUP_CRON;
}

function resolveDreamCleanupCronEnabled(workspace: WorkspaceFile | null): boolean {
  if (workspace?.dream_cleanup_cron_enabled != null) return workspace.dream_cleanup_cron_enabled;
  return resolveEnvBoolean(process.env.ENGRAM_DREAM_CLEANUP_CRON_ENABLED, true);
}

function resolveDreamCleanupOnStart(workspace: WorkspaceFile | null): boolean {
  if (workspace?.dream_cleanup_on_start != null) return workspace.dream_cleanup_on_start;
  return resolveEnvBoolean(process.env.ENGRAM_DREAM_CLEANUP_ON_START, true);
}

function resolveAutoDreamEnabled(workspace: WorkspaceFile | null): boolean {
  if (workspace?.auto_dream_enabled != null) return workspace.auto_dream_enabled;
  return resolveEnvBoolean(process.env.ENGRAM_AUTO_DREAM_ENABLED, false);
}

function resolveAutoDreamCron(workspace: WorkspaceFile | null): string {
  if (workspace?.auto_dream_cron) return workspace.auto_dream_cron;
  const fromEnv = process.env.ENGRAM_AUTO_DREAM_CRON?.trim();
  if (fromEnv) return parseCronExpression(fromEnv, "ENGRAM_AUTO_DREAM_CRON");
  return DEFAULT_AUTO_DREAM_CRON;
}

function resolveDreamAutoApprove(workspace: WorkspaceFile | null): boolean {
  if (workspace?.dream_auto_approve != null) return workspace.dream_auto_approve;
  return resolveEnvBoolean(process.env.ENGRAM_DREAM_AUTO_APPROVE, true);
}

function resolvePort(workspace: WorkspaceFile | null): number {
  const fromEnvRaw = process.env.PORT?.trim();
  const fromEnv =
    fromEnvRaw && Number.isInteger(Number(fromEnvRaw)) && Number(fromEnvRaw) > 0
      ? Number(fromEnvRaw)
      : undefined;
  return pickConfig(workspace?.port, fromEnv, 8787);
}

function resolveTempDir(workspace: WorkspaceFile | null): string {
  const fromEnv = process.env.ENGRAM_TEMP_DIR?.trim() || undefined;
  const raw = pickConfig(workspace?.temp_dir, fromEnv, "/tmp");
  return resolve(raw || "/tmp");
}

function resolveAgentMode(workspace: WorkspaceFile | null): AgentMode {
  if (workspace?.agent) return workspace.agent;
  const fromEnv = process.env.ENGRAM_AGENT?.trim();
  if (fromEnv) return parseAgentMode(fromEnv, "ENGRAM_AGENT");
  return "claude";
}

function resolveClaudeBin(workspace: WorkspaceFile | null): string {
  const fromEnv = process.env.CLAUDE_BIN?.trim() || undefined;
  return pickConfig(workspace?.claude_bin, fromEnv, "claude");
}

function resolveCursorAgentBin(workspace: WorkspaceFile | null): string {
  const fromEnv = process.env.CURSOR_AGENT_BIN?.trim() || undefined;
  return pickConfig(workspace?.cursor_agent_bin, fromEnv, "agent");
}

function resolveCursorSandbox(workspace: WorkspaceFile | null): "enabled" | "disabled" {
  if (workspace?.cursor_sandbox) return workspace.cursor_sandbox;
  const v = (process.env.ENGRAM_CURSOR_SANDBOX ?? "disabled").trim().toLowerCase();
  return v === "enabled" ? "enabled" : "disabled";
}

function resolveCodexBin(workspace: WorkspaceFile | null): string {
  const fromEnv = process.env.CODEX_BIN?.trim() || undefined;
  return pickConfig(workspace?.codex_bin, fromEnv, "codex");
}

function resolveAllowVirtualClock(workspace: WorkspaceFile | null): boolean {
  if (workspace?.allow_virtual_clock != null) return workspace.allow_virtual_clock;
  return resolveEnvBoolean(process.env.ENGRAM_ALLOW_VIRTUAL_CLOCK, false);
}

function resolveAllowStaleStore(workspace: WorkspaceFile | null): boolean {
  if (workspace?.allow_stale_store != null) return workspace.allow_stale_store;
  return resolveEnvBoolean(process.env.ENGRAM_ALLOW_STALE_STORE, false);
}

function resolveDreamDebug(workspace: WorkspaceFile | null): boolean {
  if (workspace?.dream_debug != null) return workspace.dream_debug;
  return resolveEnvBoolean(process.env.ENGRAM_DREAM_DEBUG, false);
}

function resolveMemoryDebug(workspace: WorkspaceFile | null): boolean {
  if (workspace?.memory_debug != null) return workspace.memory_debug;
  return resolveEnvBoolean(process.env.ENGRAM_MEMORY_DEBUG, false);
}

function resolveAttachmentMaxBytes(workspace: WorkspaceFile | null): number {
  if (workspace?.attachment_max_bytes != null) return workspace.attachment_max_bytes;
  const fromEnv = process.env.ENGRAM_ATTACHMENT_MAX_BYTES?.trim();
  if (fromEnv) {
    return parsePositiveIntDays(fromEnv, "ENGRAM_ATTACHMENT_MAX_BYTES");
  }
  return DEFAULT_ATTACHMENT_MAX_BYTES;
}

function resolveAttachmentTmpRetentionDays(workspace: WorkspaceFile | null): number {
  if (workspace?.attachment_tmp_retention_days != null) return workspace.attachment_tmp_retention_days;
  const fromEnv = process.env.ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS?.trim();
  if (fromEnv) {
    return parseNonNegativeIntDays(fromEnv, "ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS");
  }
  return DEFAULT_ATTACHMENT_TMP_RETENTION_DAYS;
}

function resolveAttachmentHousekeepCron(workspace: WorkspaceFile | null): string {
  if (workspace?.attachment_housekeep_cron) return workspace.attachment_housekeep_cron;
  const fromEnv = process.env.ENGRAM_ATTACHMENT_HOUSEKEEP_CRON?.trim();
  if (fromEnv) return parseCronExpression(fromEnv, "ENGRAM_ATTACHMENT_HOUSEKEEP_CRON");
  return DEFAULT_ATTACHMENT_HOUSEKEEP_CRON;
}

function resolveAttachmentHousekeepCronEnabled(workspace: WorkspaceFile | null): boolean {
  if (workspace?.attachment_housekeep_cron_enabled != null) return workspace.attachment_housekeep_cron_enabled;
  return resolveEnvBoolean(process.env.ENGRAM_ATTACHMENT_HOUSEKEEP_CRON_ENABLED, true);
}

function resolveAttachmentHousekeepOnStart(workspace: WorkspaceFile | null): boolean {
  if (workspace?.attachment_housekeep_on_start != null) return workspace.attachment_housekeep_on_start;
  return resolveEnvBoolean(process.env.ENGRAM_ATTACHMENT_HOUSEKEEP_ON_START, true);
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

/** Resolved server port, storage home, agent binaries, timezone, memory language. */
export const config = {
  port: resolvePort(workspace),
  storeDir,
  /** Host temp root for ask jobs + dream agent workdirs (not inside the memory store). */
  tempDir: resolveTempDir(workspace),
  agentMode: resolveAgentMode(workspace),
  claudeBin: resolveClaudeBin(workspace),
  cursorAgentBin: resolveCursorAgentBin(workspace),
  /**
   * Cursor CLI `--sandbox` value. Default `disabled`: Engram write isolation is
   * write-policy＋`--add-dir` only; OS sandbox needs kernel ≥6.2 and fails on WSL 5.x.
   * Set `ENGRAM_CURSOR_SANDBOX=enabled` or workspace `cursor_sandbox: enabled` when supported.
   */
  cursorSandbox: resolveCursorSandbox(workspace),
  /** Codex CLI binary (when agent=codex). */
  codexBin: resolveCodexBin(workspace),
  timezone: resolveTimezone(workspace),
  /** Effective write language for chain／node／ask (always one of MEMORY_LANGUAGES). */
  memoryLanguage: resolveMemoryLanguage(workspace),
  /** Future-sight admission window (days from dream day T). */
  futureSightWindowDays: resolveFutureSightWindowDays(workspace),
  /** Future-sight upcoming zone window (days from dream day T). */
  futureSightUpcomingDays: resolveFutureSightUpcomingDays(workspace),
  /**
   * Disk structure generation from workspace `store_version` at process start, or null if unset.
   * Prefer {@link peekStoreVersion} for live status (file may be stamped after boot).
   */
  storeVersion: workspace?.store_version ?? null,
  /** Engram product version (`version.md`). */
  productVersion,
  /** When true, PUT /clock may set a virtual memory timeline. */
  allowVirtualClock: resolveAllowVirtualClock(workspace),
  /** When true, boot may continue with stale store structure (warn only). */
  allowStaleStore: resolveAllowStaleStore(workspace),
  /** Verbose dream extract/apply logs. */
  dreamDebug: resolveDreamDebug(workspace),
  /** Verbose memory search/ask logs. */
  memoryDebug: resolveMemoryDebug(workspace),
  /** TTL days for discarded/superseded/orphan staging artifacts; 0 = recovery only. */
  dreamStagingRetentionDays: resolveDreamStagingRetentionDays(workspace),
  /** TTL days for committed report/events; -1 = keep forever. */
  dreamCommittedReportRetentionDays: resolveDreamCommittedReportRetentionDays(workspace),
  /** Minimum age before any TTL delete (safety buffer). */
  dreamCleanupMinAgeDays: resolveDreamCleanupMinAgeDays(workspace),
  /** In-process cron expression for staging cleanup. */
  dreamCleanupCron: resolveDreamCleanupCron(workspace),
  /** Register in-process cleanup cron (default true). */
  dreamCleanupCronEnabled: resolveDreamCleanupCronEnabled(workspace),
  /** Run staging cleanup on server start (default true). */
  dreamCleanupOnStart: resolveDreamCleanupOnStart(workspace),
  /** Scheduled auto dream extract (default false). */
  autoDreamEnabled: resolveAutoDreamEnabled(workspace),
  /** In-process cron for auto dream when enabled. */
  autoDreamCron: resolveAutoDreamCron(workspace),
  /** After a successful pending draft, deploy immediately (default true). */
  dreamAutoApprove: resolveDreamAutoApprove(workspace),
  /** Max bytes per attachment file (default 10 MiB). */
  attachmentMaxBytes: resolveAttachmentMaxBytes(workspace),
  /** Days to retain tmp uploads before housekeep (default 2). */
  attachmentTmpRetentionDays: resolveAttachmentTmpRetentionDays(workspace),
  /** In-process cron expression for attachment tmp housekeep. */
  attachmentHousekeepCron: resolveAttachmentHousekeepCron(workspace),
  /** Register in-process attachment housekeep cron (default true). */
  attachmentHousekeepCronEnabled: resolveAttachmentHousekeepCronEnabled(workspace),
  /** Run attachment tmp housekeep on server start (default true). */
  attachmentHousekeepOnStart: resolveAttachmentHousekeepOnStart(workspace),
};
