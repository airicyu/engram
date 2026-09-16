import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export const repoRoot = join(import.meta.dir, "..");

export const defaultStoreDirRel = "./../engram-lite-data";
export const defaultPiModel = "deepseek/deepseek-v4.1-flash";
export const projectConfigPath = join(repoRoot, "engram-lite.yaml");

export const port = Number(process.env.ENGRAM_LITE_PORT ?? "8797");

function stripQuotes(s: string) {
  return s.replace(/^["']|["']$/g, "").trim();
}

export function readStoreDirSetting(): string {
  const fromEnv = process.env.ENGRAM_LITE_STORE_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(projectConfigPath)) {
    const text = readFileSync(projectConfigPath, "utf8");
    const m = text.match(/^store_dir:\s*(.+)$/m);
    if (m?.[1]) return stripQuotes(m[1]);
  }
  return defaultStoreDirRel;
}

export function resolveStoreDir(setting = readStoreDirSetting()): string {
  if (isAbsolute(setting)) return setting;
  return resolve(repoRoot, setting);
}

export const storeDir = resolveStoreDir();

export function poolPendingPath() {
  return join(storeDir, "pool", "pending.jsonl");
}

export function poolArchivedPath() {
  return join(storeDir, "pool", "archived.jsonl");
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
  return join(storeDir, "chain");
}

export function nodesDir() {
  return join(storeDir, "nodes");
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
