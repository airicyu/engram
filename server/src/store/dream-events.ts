/** Append-only structured event log for dream runs. */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homePath } from "./home";

/** Pipeline phase recorded on a dream event. */
export type DreamEventPhase = "extract" | "materialize" | "pending_review";

/** One structured dream run event line in events.jsonl. */
export interface DreamEvent {
  ts: string;
  level: "info" | "warn" | "error";
  phase: DreamEventPhase;
  event: string;
  message?: string;
  detail?: Record<string, unknown>;
}

function runDir(dreamRunId: string): string {
  return homePath("dream", "runs", dreamRunId);
}

function eventsPath(dreamRunId: string): string {
  return homePath("dream", "runs", dreamRunId, "events.jsonl");
}

/** Append one event to the run log. */
export async function appendDreamEvent(dreamRunId: string, event: DreamEvent): Promise<void> {
  await mkdir(runDir(dreamRunId), { recursive: true });
  await appendFile(eventsPath(dreamRunId), `${JSON.stringify(event)}\n`, "utf8");
}

async function readAllEvents(dreamRunId: string): Promise<DreamEvent[]> {
  try {
    const raw = await readFile(eventsPath(dreamRunId), "utf8");
    if (!raw.trim()) return [];
    const out: DreamEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      out.push(JSON.parse(line) as DreamEvent);
    }
    return out;
  } catch {
    return [];
  }
}

/** Read events from offset (0-based line count). */
export async function readDreamEvents(
  dreamRunId: string,
  after = 0,
): Promise<{ events: DreamEvent[]; total: number }> {
  const all = await readAllEvents(dreamRunId);
  return {
    events: all.slice(after),
    total: all.length,
  };
}

/** Return the last N events for status polling. */
export async function tailDreamEvents(dreamRunId: string, n = 20): Promise<DreamEvent[]> {
  const all = await readAllEvents(dreamRunId);
  return all.slice(-n);
}
