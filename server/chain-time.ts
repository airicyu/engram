/** ISO week ids for memory chain (aligned with Engram `YYYY-Www-MMDD`). */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_RE = /^(\d{4})-W(\d{2})-(\d{2})(\d{2})$/;
const LEGACY_WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function isValidDayId(id: string): boolean {
  return DAY_RE.test(id);
}

function mondayFromIsoWeek(isoYear: number, week: number): string {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return formatDayUtc(monday);
}

function mmddFromDayId(dayId: string): string {
  return `${dayId.slice(5, 7)}${dayId.slice(8, 10)}`;
}

function formatWeekId(isoYear: number, week: number, mondayDayId: string): string {
  return `${isoYear}-W${String(week).padStart(2, "0")}-${mmddFromDayId(mondayDayId)}`;
}

/** `YYYY-Www-MMDD` where MMDD is that ISO week's Monday. */
export function isValidWeekId(id: string): boolean {
  const m = id.match(WEEK_RE);
  if (!m) return false;
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return false;
  const mm = Number(m[3]);
  const dd = Number(m[4]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const expectedMonday = mondayFromIsoWeek(isoYear, week);
  return mmddFromDayId(expectedMonday) === `${m[3]}${m[4]}`;
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

export function dayToWeekId(dayId: string): string {
  if (!isValidDayId(dayId)) throw new Error(`invalid day id: ${dayId}`);
  const d = parseDayUtc(dayId);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const monday = mondayFromIsoWeek(isoYear, weekNo);
  return formatWeekId(isoYear, weekNo, monday);
}

export function weekMonday(weekId: string): string {
  const m = weekId.match(WEEK_RE);
  if (!m) throw new Error(`invalid week id: ${weekId}`);
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  const monday = mondayFromIsoWeek(isoYear, week);
  if (mmddFromDayId(monday) !== `${m[3]}${m[4]}`) {
    throw new Error(`invalid week id (MMDD is not Monday): ${weekId}`);
  }
  return monday;
}

export function weekDateRange(weekId: string): { start: string; end: string } {
  const start = weekMonday(weekId);
  const endD = parseDayUtc(start);
  endD.setUTCDate(endD.getUTCDate() + 6);
  return { start, end: formatDayUtc(endD) };
}

/** Parent folder `YYYY-MM` (= Monday's calendar month). */
export function weekMonthKey(weekId: string): string {
  return weekMonday(weekId).slice(0, 7);
}

/** Upgrade legacy `YYYY-Www` to canonical id (for one-off renames). */
export function canonicalWeekIdFromLegacy(id: string): string | null {
  const m = id.match(LEGACY_WEEK_RE);
  if (!m) return isValidWeekId(id) ? id : null;
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const monday = mondayFromIsoWeek(isoYear, week);
  return formatWeekId(isoYear, week, monday);
}
