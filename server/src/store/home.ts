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

/** Create the required store directories and empty metadata files. */
export async function ensureEngramHome(): Promise<void> {
  const dirs = [
    "",
    "log",
    "dream",
    "dream/dead-letter-archive",
    "dream/reviews",
    "dream/runs",
    "dream/draft",
    "dream/reports",
    "short-term-memory",
    "short-term-memory/nodes",
    "memory-chain",
    "memory-chain/days",
    "memory-chain/weeks",
    "memory-chain/months",
    "memory-chain/years",
    "candidates",
    "nodes",
    "future-sight",
    "future-sight/active",
    "archive",
  ];

  for (const d of dirs) {
    await mkdir(homePath(d), { recursive: true });
  }

  const metaPath = homePath("meta.yaml");
  if (!(await exists(metaPath))) {
    await writeFile(
      metaPath,
      stringify({
        timezone: config.timezone,
        created_at: new Date().toISOString(),
      }),
      "utf8",
    );
  }

  const eventsPath = homePath("log", "events.jsonl");
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

  const candidatesNodes = homePath("candidates", "nodes.yaml");
  if (!(await exists(candidatesNodes))) {
    await writeFile(candidatesNodes, stringify({ candidates: [] }), "utf8");
  }

  const candidatesAttr = homePath("candidates", "attribution.yaml");
  if (!(await exists(candidatesAttr))) {
    await writeFile(candidatesAttr, stringify({ candidates: [] }), "utf8");
  }

  await ensureL1SummaryFile();
  await ensureDreamDirs();
}
