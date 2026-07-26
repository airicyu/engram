/** Engram home directory paths and initial store scaffolding. */

import { access, mkdir, writeFile } from "node:fs/promises";
import { ensureShortTermMemorySummaryFile } from "./memories/short-term-memory";
import { ensureDreamDirs } from "./dreams/dream-runs";
import { join } from "node:path";
import { stringify } from "../yaml";
import { config } from "../config";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a path within the configured ENGRAM_STORE_DIR. */
export function homePath(...parts: string[]): string {
  return join(config.storeDir, ...parts);
}

/** Create the required store directories and empty metadata files (0.14 layout). */
export async function ensureEngramHome(): Promise<void> {
  const dirs = [
    "",
    "memories/activities",
    "memories/short-term-memory",
    "memories/short-term-memory/nodes",
    "memories/chain",
    "memories/chain/days",
    "memories/chain/weeks",
    "memories/chain/months",
    "memories/chain/years",
    "memories/nodes",
    "memories/future-sight",
    "memories/future-sight/active",
    "dreams",
    "dreams/runs",
    "dreams/draft",
    "dreams/reports",
    "dreams/candidates",
    "tmp/ask/jobs",
  ];

  for (const d of dirs) {
    await mkdir(homePath(d), { recursive: true });
  }

  const eventsPath = homePath("memories", "activities", "events.jsonl");
  if (!(await exists(eventsPath))) {
    await writeFile(eventsPath, "", "utf8");
  }

  const patchesPath = homePath("dreams", "patches.jsonl");
  if (!(await exists(patchesPath))) {
    await writeFile(patchesPath, "", "utf8");
  }

  const dlqPath = homePath("dreams", "dead-letter.jsonl");
  if (!(await exists(dlqPath))) {
    await writeFile(dlqPath, "", "utf8");
  }

  const candidatesAttr = homePath("dreams", "candidates", "attribution.yaml");
  if (!(await exists(candidatesAttr))) {
    await writeFile(candidatesAttr, stringify({ candidates: [] }), "utf8");
  }

  await ensureShortTermMemorySummaryFile();
  await ensureDreamDirs();
}
