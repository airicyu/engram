import { open, readFile, writeFile } from "node:fs/promises";
import { homePath } from "./home";

export interface Event {
  id: string;
  ts: string;
  source: string;
  raw: string;
  node_refs?: string[];
  ingest_meta?: Record<string, unknown>;
  idempotency_key?: string;
}

function eventsPath(): string {
  return homePath("log", "events.jsonl");
}

export async function readAllEvents(): Promise<Event[]> {
  const text = await readFile(eventsPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

export async function nextEventId(): Promise<string> {
  const events = await readAllEvents();
  const n = events.length + 1;
  return `e${String(n).padStart(6, "0")}`;
}

export async function appendEvent(event: Event): Promise<void> {
  const fh = await open(eventsPath(), "a");
  try {
    await fh.write(`${JSON.stringify(event)}\n`);
  } finally {
    await fh.close();
  }
}

/** Events whose ts falls on calendar day in Asia/Taipei (YYYY-MM-DD). */
export async function eventsForDay(day: string): Promise<Event[]> {
  const events = await readAllEvents();
  return events.filter((e) => taipeiDate(e.ts) === day);
}

export function taipeiDate(isoOrNow?: string): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function taipeiNowIso(): string {
  // Format like 2026-07-18T23:10:00+08:00
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

export async function rewriteEvents(events: Event[]): Promise<void> {
  const body = events.map((e) => JSON.stringify(e)).join("\n");
  await writeFile(eventsPath(), body ? body + "\n" : "", "utf8");
}
