import { access } from "node:fs/promises";
import { join } from "node:path";
import { stampInTimezone } from "../vault/memories.ts";

/** Local calendar dates from pool lines whose `ts` parses. Unparseable lines are skipped. */
export function poolLocalDates(lines: string[], timeZone: string): string[] {
  const dates: string[] = [];
  for (const line of lines) {
    let ts: unknown;
    try {
      ts = JSON.parse(line).ts;
    } catch {
      continue;
    }
    if (typeof ts !== "string") continue;
    const at = new Date(ts);
    if (Number.isNaN(at.getTime())) continue;
    dates.push(stampInTimezone(timeZone, at).ts.slice(0, 10));
  }
  return dates;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Dates from min to max inclusive that have no day file. Empty input stays empty. */
export async function missingDaysInSpan(memoriesRoot: string, dates: string[]): Promise<string[]> {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const missing: string[] = [];
  for (let day = min; day <= max; day = nextDay(day)) {
    const path = join(memoriesRoot, "chain", "days", day.slice(0, 7), `${day}.md`);
    try {
      await access(path);
    } catch {
      missing.push(day);
    }
    if (day === max) break;
  }
  return missing;
}
