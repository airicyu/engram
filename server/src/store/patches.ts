/** Persistence helpers for extracted dream patches in JSONL. */

import { open, readFile } from "node:fs/promises";
import { $ } from "bun";
import { homePath } from "./home";
import type { Patch } from "../dream/schema";

function patchesPath(): string {
  return homePath("dream", "patches.jsonl");
}

function dreamRunNeedle(dreamRunId: string): string {
  return `"dream_run_id":"${dreamRunId}"`;
}

/** Read all extracted patches across dream runs. */
export async function readAllPatches(): Promise<Patch[]> {
  const text = await readFile(patchesPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Patch);
}

/** Patches for one run via `grep -F` — avoids loading the whole patches.jsonl into memory. */
export async function patchesForRun(dreamRunId: string): Promise<Patch[]> {
  const path = patchesPath();
  if (!(await Bun.file(path).exists())) return [];
  const r = await $`grep -F ${dreamRunNeedle(dreamRunId)} ${path}`.nothrow();
  if (r.exitCode !== 0) return [];
  const text = (await r.text()).trim();
  if (!text) return [];
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Patch);
}

/** Return whether a dream run already has persisted patches. */
export async function hasPatchesForRun(dreamRunId: string): Promise<boolean> {
  const path = patchesPath();
  if (!(await Bun.file(path).exists())) return false;
  const r = await $`grep -F -q ${dreamRunNeedle(dreamRunId)} ${path}`.nothrow();
  return r.exitCode === 0;
}

/** Append patches for a run. No-op if dream_run_id already has patches. */
export async function appendPatchesIfNew(
  dreamRunId: string,
  patches: Patch[],
): Promise<{ written: boolean; patches: Patch[] }> {
  if (await hasPatchesForRun(dreamRunId)) {
    return { written: false, patches: await patchesForRun(dreamRunId) };
  }
  const fh = await open(patchesPath(), "a");
  try {
    for (const p of patches) {
      await fh.write(`${JSON.stringify(p)}\n`);
    }
  } finally {
    await fh.close();
  }
  return { written: true, patches };
}
