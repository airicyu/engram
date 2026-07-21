import { readFile } from "node:fs/promises";
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
