/** Engram home directory paths and initial store scaffolding. */

import { access, mkdir, writeFile } from "node:fs/promises";
import { ensureL1SummaryFile } from "./l1";
import { ensureDreamDirs } from "./dream-runs";
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

/** Resolve a path within the configured ENGRAM_HOME. */
export function homePath(...parts: string[]): string {
  return join(config.engramHome, ...parts);
}

/** Create the required store directories and empty metadata files (0.14 layout). */
export async function ensureEngramHome(): Promise<void> {
  const dirs = [
    "",
    "memory/activities",
    "memory/short-term-memory",
    "memory/short-term-memory/nodes",
    "memory/memory-chain",
    "memory/memory-chain/days",
    "memory/memory-chain/weeks",
    "memory/memory-chain/months",
    "memory/memory-chain/years",
    "memory/nodes",
    "memory/future-sight",
    "memory/future-sight/active",
    "dream",
    "dream/runs",
    "dream/draft",
    "dream/reports",
    "dream/candidates",
    "tmp/ask/jobs",
  ];

  for (const d of dirs) {
    await mkdir(homePath(d), { recursive: true });
  }

  const eventsPath = homePath("memory", "activities", "events.jsonl");
  if (!(await exists(eventsPath))) {
    await writeFile(eventsPath, "", "utf8");
  }

  const patchesPath = homePath("dream", "patches.jsonl");
  if (!(await exists(patchesPath))) {
    await writeFile(patchesPath, "", "utf8");
  }

  const dlqPath = homePath("dream", "dead-letter.jsonl");
  if (!(await exists(dlqPath))) {
    await writeFile(dlqPath, "", "utf8");
  }

  const candidatesAttr = homePath("dream", "candidates", "attribution.yaml");
  if (!(await exists(candidatesAttr))) {
    await writeFile(candidatesAttr, stringify({ candidates: [] }), "utf8");
  }

  await ensureL1SummaryFile();
  await ensureDreamDirs();
}
