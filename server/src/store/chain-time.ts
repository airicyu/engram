/** Calendar / ISO-week helpers for memory-chain ids (day → week → month → year). */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;

export type ChainLevel = "day" | "week" | "month" | "year";

export function isValidDayId(id: string): boolean {
  return DAY_RE.test(id);
}

export function isValidWeekId(id: string): boolean {
  const m = id.match(WEEK_RE);
  if (!m) return false;
  const week = Number(m[2]);
  return week >= 1 && week <= 53;
}

export function isValidMonthId(id: string): boolean {
  if (!MONTH_RE.test(id)) return false;
  const month = Number(id.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function isValidYearId(id: string): boolean {
  return YEAR_RE.test(id);
}

function parseDayUtc(dayId: string): Date {
  const [y, m, d] = dayId.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDayUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO week id `YYYY-Www` for a calendar day (ISO week-year). */
export function dayToWeekId(dayId: string): string {
  if (!isValidDayId(dayId)) throw new Error(`invalid day id: ${dayId}`);
  const d = parseDayUtc(dayId);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function dayToMonthId(dayId: string): string {
  if (!isValidDayId(dayId)) throw new Error(`invalid day id: ${dayId}`);
  return dayId.slice(0, 7);
}

export function dayToYearId(dayId: string): string {
  if (!isValidDayId(dayId)) throw new Error(`invalid day id: ${dayId}`);
  return dayId.slice(0, 4);
}

/** Monday (UTC calendar) of an ISO week. */
export function weekMonday(weekId: string): string {
  const m = weekId.match(WEEK_RE);
  if (!m) throw new Error(`invalid week id: ${weekId}`);
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return formatDayUtc(monday);
}

/** Parent folder `YYYY-MM` for a week (= Monday's calendar month). */
export function weekMonthKey(weekId: string): string {
  return weekMonday(weekId).slice(0, 7);
}

export function monthYearKey(monthId: string): string {
  if (!isValidMonthId(monthId)) throw new Error(`invalid month id: ${monthId}`);
  return monthId.slice(0, 4);
}

/** Inclusive Mon–Sun day ids for an ISO week. */
export function daysInWeek(weekId: string): string[] {
  const monday = parseDayUtc(weekMonday(weekId));
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    out.push(formatDayUtc(d));
  }
  return out;
}

/** First day `YYYY-MM-01` and exclusive next-month start for a month id. */
export function monthDateRange(monthId: string): { start: string; endExclusive: string } {
  if (!isValidMonthId(monthId)) throw new Error(`invalid month id: ${monthId}`);
  const [y, m] = monthId.split("-").map(Number);
  const start = `${monthId}-01`;
  const next = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return { start, endExclusive: formatDayUtc(next) };
}

/**
 * ISO weeks whose Mon–Sun range overlaps [monthStart, nextMonthStart).
 * Cross-month weeks appear in both months' read sets.
 */
export function weeksOverlappingMonth(monthId: string): string[] {
  const { start, endExclusive } = monthDateRange(monthId);
  const startD = parseDayUtc(start);
  const endD = parseDayUtc(endExclusive);
  // Walk from Monday on/before start through endExclusive
  const cursor = new Date(startD);
  const dayNum = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - dayNum + 1);
  const ids: string[] = [];
  while (cursor < endD) {
    const mon = formatDayUtc(cursor);
    const sun = new Date(cursor);
    sun.setUTCDate(cursor.getUTCDate() + 6);
    // overlap if week intersects [start, endExclusive)
    if (sun >= startD && cursor < endD) {
      ids.push(dayToWeekId(mon));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return [...new Set(ids)];
}

/** Mechanical candidates from day ids touched this dream. */
export function candidatesFromDayIds(dayIds: string[]): {
  weeks: string[];
  months: string[];
  years: string[];
} {
  const weeks = new Set<string>();
  const months = new Set<string>();
  const years = new Set<string>();
  for (const dayId of dayIds) {
    if (!isValidDayId(dayId)) continue;
    weeks.add(dayToWeekId(dayId));
    months.add(dayToMonthId(dayId));
    years.add(dayToYearId(dayId));
  }
  const sort = (xs: Set<string>) => [...xs].sort();
  return { weeks: sort(weeks), months: sort(months), years: sort(years) };
}

/** Whether calendar month is still "open" relative to today (today within month). */
export function isCurrentMonth(monthId: string, today: string): boolean {
  return dayToMonthId(today) === monthId;
}

/** Whether ISO week contains today. */
export function isCurrentWeek(weekId: string, today: string): boolean {
  return dayToWeekId(today) === weekId;
}

export function isCurrentYear(yearId: string, today: string): boolean {
  return dayToYearId(today) === yearId;
}
