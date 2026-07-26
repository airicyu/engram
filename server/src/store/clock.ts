/** Virtual clock for time-replay: single source of "now" / "today" for memory timeline. */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../config";
import { homePath } from "./home";

let virtualMs: number | null = null;
let loaded = false;

function clockFilePath(): string {
  return homePath("tmp", "clock.json");
}

/** True when PUT /clock is permitted (`ENGRAM_ALLOW_VIRTUAL_CLOCK=1`). */
export function isVirtualClockAllowed(): boolean {
  return config.allowVirtualClock;
}

/** Instant used by nowIso / calendarDate when no explicit timestamp is passed. */
export function getClockDate(): Date {
  if (virtualMs != null) return new Date(virtualMs);
  return new Date();
}

export function clockMode(): "system" | "virtual" {
  return virtualMs != null ? "virtual" : "system";
}

/** Load persisted virtual clock (if any). Safe to call multiple times. */
export async function loadClockFromDisk(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const text = await readFile(clockFilePath(), "utf8");
    if (!text.trim()) return;
    const data = JSON.parse(text) as { now?: string };
    if (typeof data.now !== "string" || !data.now.trim()) return;
    const d = new Date(data.now);
    if (!Number.isNaN(d.getTime())) {
      virtualMs = d.getTime();
    }
  } catch {
    // missing / unreadable → system clock
  }
}

async function persist(): Promise<void> {
  const path = clockFilePath();
  await mkdir(dirname(path), { recursive: true });
  if (virtualMs == null) {
    try {
      await unlink(path);
    } catch {
      // ignore
    }
    return;
  }
  const now = formatIsoInTimezone(new Date(virtualMs), config.timezone);
  await writeFile(path, `${JSON.stringify({ now }, null, 2)}\n`, "utf8");
}

/** Set virtual now from an ISO-8601 string (or Date). Returns formatted local ISO. */
export async function setVirtualNow(isoOrDate: string | Date): Promise<string> {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid datetime");
  }
  virtualMs = d.getTime();
  loaded = true;
  await persist();
  return formatIsoInTimezone(d, config.timezone);
}

/** Clear virtual clock and remove persistence file. */
export async function clearVirtualNow(): Promise<void> {
  virtualMs = null;
  loaded = true;
  await persist();
}

export interface ClockSnapshot {
  mode: "system" | "virtual";
  now: string;
  today: string;
  timezone: string;
  allow_set: boolean;
}

/** Snapshot for GET /clock and /status.clock. */
export function getClockSnapshot(): ClockSnapshot {
  const d = getClockDate();
  const now = formatIsoInTimezone(d, config.timezone);
  return {
    mode: clockMode(),
    now,
    today: calendarDateFromDate(d, config.timezone),
    timezone: config.timezone,
    allow_set: isVirtualClockAllowed(),
  };
}

/**
 * Build a Date from calendar day + optional local time in `config.timezone`.
 * `day` = YYYY-MM-DD; `time` = HH:mm:ss (default 12:00:00).
 */
export function dateFromDayTime(day: string, time = "12:00:00"): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("day must be YYYY-MM-DD");
  }
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    throw new Error("time must be HH:mm:ss");
  }
  // Guess UTC, then apply zone offset at that instant (works for fixed-offset zones;
  // for DST zones one iteration is usually enough).
  let guess = new Date(`${day}T${time}Z`);
  for (let i = 0; i < 2; i++) {
    const offset = formatTimeZoneOffset(guess, config.timezone);
    guess = new Date(`${day}T${time}${offset}`);
  }
  if (Number.isNaN(guess.getTime())) {
    throw new Error("invalid day/time");
  }
  // Verify the calendar day in zone matches
  if (calendarDateFromDate(guess, config.timezone) !== day) {
    throw new Error("day/time does not resolve in configured timezone");
  }
  return guess;
}

/** ISO-8601 local timestamp with numeric offset for an IANA zone. */
export function formatIsoInTimezone(d: Date, timeZone: string): string {
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

/** Calendar date YYYY-MM-DD in an IANA zone. */
export function calendarDateFromDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** e.g. `+08:00` from IANA zone via Intl longOffset. */
export function formatTimeZoneOffset(date: Date, timeZone: string): string {
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

/** Reset in-memory state (tests). Does not touch disk. */
export function _resetClockForTests(): void {
  virtualMs = null;
  loaded = false;
}
