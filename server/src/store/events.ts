/** Append-only L0 event log access and timezone-aware timestamp helpers. */

import { open, readFile, writeFile } from "node:fs/promises";
import { $ } from "bun";
import { config } from "../config";
import { homePath } from "./home";

/** One persisted L0 capture event. */
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

function formatEventId(n: number): string {
  return `e${String(n).padStart(10, "0")}`;
}

/** Read and parse the complete L0 event log. */
export async function readAllEvents(): Promise<Event[]> {
  const text = await readFile(eventsPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

/**
 * Next event id = line count + 1 (append-only log).
 * Uses `wc -l` so we do not load/parse the whole JSONL into JS.
 * (`tail` is for last-N lines / last id; counting needs `wc`.)
 */
export async function nextEventId(): Promise<string> {
  const path = eventsPath();
  if (!(await Bun.file(path).exists())) {
    return formatEventId(1);
  }
  const out = (await $`wc -l < ${path}`.text()).trim();
  const count = Number.parseInt(out, 10);
  const n = Number.isFinite(count) && count >= 0 ? count + 1 : 1;
  return formatEventId(n);
}

/** Append one event to the L0 JSONL log. */
export async function appendEvent(event: Event): Promise<void> {
  const fh = await open(eventsPath(), "a");
  try {
    await fh.write(`${JSON.stringify(event)}\n`);
  } finally {
    await fh.close();
  }
}

/** Events whose ts falls on a calendar day in the configured timezone (YYYY-MM-DD). */
export async function eventsForDay(day: string): Promise<Event[]> {
  const events = await readAllEvents();
  return events.filter((e) => calendarDate(e.ts) === day);
}

/** Calendar date `YYYY-MM-DD` in `config.timezone` (default Asia/Hong_Kong). */
export function calendarDate(isoOrNow?: string): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** ISO-8601 local timestamp with numeric offset for `config.timezone`. */
export function nowIso(): string {
  const d = new Date();
  const timeZone = config.timezone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const offset = formatTimeZoneOffset(d, timeZone);
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;
}

/** e.g. `+08:00` from IANA zone via Intl longOffset. */
function formatTimeZoneOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (name === "GMT" || name === "UTC") return "+00:00";
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "+00:00";
  const sign = m[1];
  const hh = m[2].padStart(2, "0");
  const mm = (m[3] ?? "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Replace the L0 event log with the supplied events. */
export async function rewriteEvents(events: Event[]): Promise<void> {
  const body = events.map((e) => JSON.stringify(e)).join("\n");
  await writeFile(eventsPath(), body ? body + "\n" : "", "utf8");
}
