/** Read access for dream patch dead-letter entries. */

import { readFile } from "node:fs/promises";
import { $ } from "bun";
import { homePath } from "./home";
import type { Patch } from "../dream/schema";

/** A patch retained for manual review after processing failure. */
export interface DeadLetterEntry {
  dl_id: string;
  ts: string;
  error: string;
  patch: Patch;
}

function dlqPath(): string {
  return homePath("dream", "dead-letter.jsonl");
}

/** Read all pending dead-letter entries. */
export async function readPendingDlq(): Promise<DeadLetterEntry[]> {
  const text = await readFile(dlqPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DeadLetterEntry);
}

/** Line count only — do not parse the whole DLQ JSONL. */
export async function pendingDlqCount(): Promise<number> {
  const path = dlqPath();
  if (!(await Bun.file(path).exists())) return 0;
  const out = (await $`wc -l < ${path}`.text()).trim();
  const count = Number.parseInt(out, 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}
