import { open, readFile } from "node:fs/promises";
import { homePath } from "./home";
import type { Patch } from "../dream/schema";

export interface DeadLetterEntry {
  dl_id: string;
  ts: string;
  error: string;
  patch: Patch;
}

function dlqPath(): string {
  return homePath("dream", "dead-letter.jsonl");
}

export async function readPendingDlq(): Promise<DeadLetterEntry[]> {
  const text = await readFile(dlqPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DeadLetterEntry);
}

export async function pendingDlqCount(): Promise<number> {
  return (await readPendingDlq()).length;
}

export async function appendDlq(patch: Patch, error: string): Promise<string> {
  const existing = await readPendingDlq();
  const n = existing.length + 1;
  const dl_id = `dl-${String(n).padStart(3, "0")}`;
  const entry: DeadLetterEntry = {
    dl_id,
    ts: new Date().toISOString(),
    error,
    patch,
  };
  const fh = await open(dlqPath(), "a");
  try {
    await fh.write(`${JSON.stringify(entry)}\n`);
  } finally {
    await fh.close();
  }
  return dl_id;
}

export async function isPatchInDlq(patchId: string): Promise<boolean> {
  const entries = await readPendingDlq();
  return entries.some((e) => e.patch.patch_id === patchId);
}
