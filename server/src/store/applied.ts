import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { homePath } from "./home";

function appliedPath(): string {
  return homePath("dream", "applied.yaml");
}

interface AppliedFile {
  applied: string[];
}

export async function readApplied(): Promise<Set<string>> {
  const text = await readFile(appliedPath(), "utf8");
  const data = parse(text) as AppliedFile | null;
  return new Set(data?.applied ?? []);
}

export async function markApplied(patchId: string): Promise<void> {
  const set = await readApplied();
  if (set.has(patchId)) return;
  set.add(patchId);
  await writeFile(appliedPath(), stringify({ applied: [...set] }), "utf8");
}

export async function isApplied(patchId: string): Promise<boolean> {
  const set = await readApplied();
  return set.has(patchId);
}
