import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export const repoRoot = join(import.meta.dir, "..");

export const defaultStoreDirRel = "./../engram-lite-data";
export const defaultPort = 8797;
export const defaultPiModel = "deepseek/deepseek-v4.1-flash";
export const projectConfigPath = join(repoRoot, "engram-lite.yaml");

function stripQuotes(s: string) {
  return s.replace(/^["']|["']$/g, "").trim();
}

function projectYaml(): Record<string, string> {
  if (!existsSync(projectConfigPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(projectConfigPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = stripQuotes(t.slice(i + 1));
  }
  return out;
}

export function readStoreDirSetting(): string {
  const fromEnv = process.env.ENGRAM_LITE_STORE_DIR?.trim();
  if (fromEnv) return fromEnv;
  const fromYaml = projectYaml().store_dir?.trim();
  if (fromYaml) return fromYaml;
  return defaultStoreDirRel;
}

export function readPort(): number {
  const fromEnv = process.env.ENGRAM_LITE_PORT?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  const fromYaml = projectYaml().port?.trim();
  if (fromYaml) {
    const n = Number(fromYaml);
    if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  return defaultPort;
}

export const port = readPort();

export function resolveStoreDir(setting = readStoreDirSetting()): string {
  if (isAbsolute(setting)) return setting;
  return resolve(repoRoot, setting);
}

export const storeDir = resolveStoreDir();

/** Obsidian vault (chain / nodes / pool / attachments). Not jobs or workspace.yaml. */
export function memoriesDir() {
  return join(storeDir, "memories");
}

export function attachmentsDir() {
  return join(memoriesDir(), "_attachments", "uploads");
}

export function poolPendingPath() {
  return join(memoriesDir(), "pool", "pending.jsonl");
}

export function poolArchivedPath() {
  return join(memoriesDir(), "pool", "archived.jsonl");
}

export function workspacePath() {
  return join(storeDir, "workspace.yaml");
}

export function jobsDir() {
  return join(storeDir, "jobs");
}

export function jobPath(id: string) {
  return join(jobsDir(), `${id}.json`);
}

export function chainDir() {
  return join(memoriesDir(), "chain");
}

export function nodesDir() {
  return join(memoriesDir(), "nodes");
}

export function clarifyDir() {
  return join(memoriesDir(), "clarify");
}

export function clarifyBucketDir(bucket: "asking" | "pending" | "history") {
  return join(clarifyDir(), bucket);
}

export function clarifyFile(bucket: "asking" | "pending" | "history", id: string) {
  return join(clarifyBucketDir(bucket), `${id}.md`);
}

export type ChainLevel = "day" | "week" | "month" | "year";

export function chainFile(level: ChainLevel, id: string): string | null {
  if (level === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
    const ym = id.slice(0, 7);
    return join(chainDir(), "days", ym, `${id}.md`);
  }
  if (level === "week") {
    if (!/^\d{4}-W\d{2}$/.test(id)) return null;
    return null;
  }
  if (level === "month") {
    if (!/^\d{4}-\d{2}$/.test(id)) return null;
    return join(chainDir(), "months", id.slice(0, 4), `${id}.md`);
  }
  if (level === "year") {
    if (!/^\d{4}$/.test(id)) return null;
    return join(chainDir(), "years", `${id}.md`);
  }
  return null;
}

export function nodeFile(id: string): string | null {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) return null;
  return join(nodesDir(), id, `${id}.md`);
}
