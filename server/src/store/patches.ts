import { open, readFile } from "node:fs/promises";
import { homePath } from "./home";
import type { Patch } from "../dream/schema";

function patchesPath(): string {
  return homePath("dream", "patches.jsonl");
}

export async function readAllPatches(): Promise<Patch[]> {
  const text = await readFile(patchesPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Patch);
}

export async function patchesForRun(dreamRunId: string): Promise<Patch[]> {
  const all = await readAllPatches();
  return all.filter((p) => p.dream_run_id === dreamRunId);
}

export async function hasPatchesForRun(dreamRunId: string): Promise<boolean> {
  const patches = await patchesForRun(dreamRunId);
  return patches.length > 0;
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
