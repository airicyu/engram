/** Append-only structured event log for memory ask jobs. */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homePath } from "../home";

/** Pipeline phase recorded on an ask event. */
export type AskEventPhase = "prepare" | "agent" | "parse";

/** One structured ask job event line in events.jsonl. */
export interface AskEvent {
  ts: string;
  level: "info" | "warn" | "error";
  phase: AskEventPhase;
  event: string;
  message?: string;
  detail?: Record<string, unknown>;
}

function jobDir(jobId: string): string {
  return homePath("tmp", "ask", "jobs", jobId);
}

function eventsPath(jobId: string): string {
  return homePath("tmp", "ask", "jobs", jobId, "events.jsonl");
}

/** Append one event to the ask job log. */
export async function appendAskEvent(jobId: string, event: AskEvent): Promise<void> {
  await mkdir(jobDir(jobId), { recursive: true });
  await appendFile(eventsPath(jobId), `${JSON.stringify(event)}\n`, "utf8");
}

async function readAllEvents(jobId: string): Promise<AskEvent[]> {
  try {
    const raw = await readFile(eventsPath(jobId), "utf8");
    if (!raw.trim()) return [];
    const out: AskEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      out.push(JSON.parse(line) as AskEvent);
    }
    return out;
  } catch {
    return [];
  }
}

/** Return the last N events for polling. */
export async function tailAskEvents(jobId: string, n = 20): Promise<AskEvent[]> {
  const all = await readAllEvents(jobId);
  return all.slice(-n);
}

/** Read events from offset (0-based line count). */
export async function readAskEvents(
  jobId: string,
  after = 0,
): Promise<{ events: AskEvent[]; total: number }> {
  const all = await readAllEvents(jobId);
  return { events: all.slice(after), total: all.length };
}
