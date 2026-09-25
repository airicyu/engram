import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { isValidWeekId, weekMonthKey } from "../chain/time.ts";
import { isValidNodeId } from "../nodes/id.ts";

export const repoRoot = join(import.meta.dir, "../..");

export const defaultStoreDirRel = "./demo-engram-lite-data";
export const defaultPort = 8797;
export const defaultPiModel = "deepseek/deepseek-v4.1-flash";
export const projectEnvPath = join(repoRoot, ".env");

function stripQuotes(s: string) {
  return s.replace(/^["']|["']$/g, "").trim();
}

function projectEnv(): Record<string, string> {
  if (!existsSync(projectEnvPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(projectEnvPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const body = t.startsWith("export ") ? t.slice("export ".length).trim() : t;
    const i = body.indexOf("=");
    if (i <= 0) continue;
    out[body.slice(0, i).trim()] = stripQuotes(body.slice(i + 1).trim());
  }
  return out;
}

export function readStoreDirSetting(): string {
  const fromEnv = process.env.ENGRAM_LITE_STORE_DIR?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = projectEnv().ENGRAM_LITE_STORE_DIR?.trim();
  if (fromFile) return fromFile;
  return defaultStoreDirRel;
}

export function readPort(): number {
  const fromEnv = process.env.ENGRAM_LITE_PORT?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  const fromFile = projectEnv().ENGRAM_LITE_PORT?.trim();
  if (fromFile) {
    const n = Number(fromFile);
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
    if (!isValidWeekId(id)) return null;
    const ym = weekMonthKey(id);
    return join(chainDir(), "weeks", ym, `${id}.md`);
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
  if (!isValidNodeId(id)) return null;
  return join(nodesDir(), id, `${id}.md`);
}
