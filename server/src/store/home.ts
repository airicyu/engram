/** Engram home directory paths and initial store scaffolding. */

import { access, mkdir, writeFile } from "node:fs/promises";
import { ensureShortTermMemorySummaryFile } from "./memories/short-term-memory";
import { ensureFutureSightFiles } from "./memories/future-sight";
import { ensureDreamDirs } from "./dreams/dream-runs";
import { ensureStoreGit } from "./git";
import { ensureAttachmentsDir } from "./memories/attachments";
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
    "dreams",
    "dreams/runs",
    "dreams/draft",
    "dreams/reports",
    "dreams/candidates",
    "tmp",
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

  const candidatesAttr = homePath("dreams", "candidates", "attribution.yaml");
  if (!(await exists(candidatesAttr))) {
    await writeFile(candidatesAttr, stringify({ candidates: [] }), "utf8");
  }

  await ensureShortTermMemorySummaryFile();
  await ensureFutureSightFiles();
  await ensureDreamDirs();
  await ensureAttachmentsDir();
  await ensureWorkspaceFile();
  // 0.16: store must be a local git repo (no git binary / ensure failure → refuse start).
  await ensureStoreGit();
}

/**
 * Create `engram.workspace.yaml` only when missing.
 * Never backfills `store_version` onto an existing file (avoids mis-labeling older stores).
 */
async function ensureWorkspaceFile(): Promise<void> {
  const path = homePath("engram.workspace.yaml");
  if (await exists(path)) return;
  const storeVersion = config.productVersion;
  const doc = {
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    store_version: storeVersion,
  };
  await writeFile(
    path,
    `# Engram workspace preferences (per memory store)\n${stringify(doc)}`,
    "utf8",
  );
  // Same process: status should see the new stamp without restart.
  (config as { storeVersion: string | null }).storeVersion = storeVersion;
}
