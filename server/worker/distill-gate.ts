import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { dayToWeekId, weekDateRange, weekMonthKey } from "../chain/time.ts";
import { parseZoneFile } from "../future-sight/index.ts";

/** Lines and clarify ids present when Session A starts, plus day mtimes. */
export type DistillSnapshot = {
  poolLines: string[];
  clarifyIds: string[];
  dayMtimes: Map<string, number>;
};

export type DistillGap =
  | { kind: "pool"; id: string }
  | { kind: "clarify"; id: string }
  | { kind: "week"; weekId: string; days: string[]; open: boolean }
  | { kind: "month"; monthId: string; days: string[] }
  | { kind: "year"; yearId: string; days: string[] }
  | { kind: "future"; id: string };

function poolLineId(line: string): string {
  try {
    const id = JSON.parse(line).id;
    if (typeof id === "string" && id.length > 0) return id;
  } catch {
    /* keep a short fallback */
  }
  return line.slice(0, 48);
}

async function readLines(path: string): Promise<string[]> {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

async function listMarkdownIds(dir: string): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names.filter((n) => n.endsWith(".md") && n !== ".gitkeep").map((n) => n.slice(0, -3));
  } catch {
    return [];
  }
}

async function listDayFiles(memoriesRoot: string): Promise<{ id: string; path: string }[]> {
  const daysRoot = join(memoriesRoot, "chain", "days");
  const out: { id: string; path: string }[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name)) {
        out.push({ id: entry.name.slice(0, 10), path });
      }
    }
  }
  await walk(daysRoot);
  return out;
}

export async function snapshotDistill(memoriesRoot: string): Promise<DistillSnapshot> {
  const poolLines = await readLines(join(memoriesRoot, "pool", "pending.jsonl"));
  const clarifyIds = await listMarkdownIds(join(memoriesRoot, "clarify", "pending"));
  const dayMtimes = new Map<string, number>();
  for (const day of await listDayFiles(memoriesRoot)) {
    const info = await stat(day.path);
    dayMtimes.set(day.id, info.mtimeMs);
  }
  return { poolLines, clarifyIds, dayMtimes };
}

function monthClosed(monthId: string, today: string): boolean {
  return monthId < today.slice(0, 7);
}

function monthPath(memoriesRoot: string, monthId: string): string {
  return join(memoriesRoot, "chain", "months", monthId.slice(0, 4), `${monthId}.md`);
}

/**
 * Mechanical leftovers after Session A stops.
 * A day created or rewritten in an open ISO week requires that week's file to be newer and to
 * carry frontmatter `open: true`.
 * A day created or rewritten in a closed week (local today is after that week's Sunday) requires
 * that week's file to be newer and to not carry `open: true`.
 * Month files are required when this run touches a day in a closed month, or rewrites a closed week
 * that overlaps a closed month. The month file must be newer than those day and week files.
 * Year files follow the same rule for a closed year (today's year is after that year): the year file
 * must be newer than the day, week, and month files this run touched in that year.
 */
function frontmatterBlock(text: string): string | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  return text.slice(4, end);
}

function frontmatterHasOpen(text: string): boolean {
  const block = frontmatterBlock(text);
  if (block === null) return false;
  return /^open:\s*true\s*$/m.test(block);
}

/** Trimmed scalar, or null when the key is absent. Blank and quoted-blank count as "". */
function frontmatterScalar(block: string, key: string): string | null {
  const match = block.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/** History copy of a pre-run pending id: exactly one non-empty absorb or dismiss key. */
export async function clarifyHistoryMarkerGap(memoriesRoot: string, id: string): Promise<boolean> {
  let text = "";
  try {
    text = await readFile(join(memoriesRoot, "clarify", "history", `${id}.md`), "utf8");
  } catch {
    return true;
  }
  const block = frontmatterBlock(text);
  if (block === null) return true;
  const absorbed = frontmatterScalar(block, "absorbed_at");
  const dismissed = frontmatterScalar(block, "dismissed_because");
  const hasAbsorbed = absorbed !== null && absorbed.length > 0;
  const hasDismissed = dismissed !== null && dismissed.length > 0;
  return hasAbsorbed === hasDismissed;
}

async function weekFileGap(
  memoriesRoot: string,
  weekId: string,
  days: string[],
  wantOpen: boolean,
): Promise<boolean> {
  const weekPath = join(memoriesRoot, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`);
  let weekMtime = 0;
  let text = "";
  try {
    const info = await stat(weekPath);
    weekMtime = info.mtimeMs;
    text = await readFile(weekPath, "utf8");
  } catch {
    return true;
  }
  let newest = 0;
  for (const id of days) {
    const path = join(memoriesRoot, "chain", "days", id.slice(0, 7), `${id}.md`);
    const mtime = (await stat(path)).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  if (weekMtime <= newest) return true;
  const marked = frontmatterHasOpen(text);
  return wantOpen ? !marked : marked;
}

export async function distillGaps(
  memoriesRoot: string,
  before: DistillSnapshot,
  today: string,
): Promise<DistillGap[]> {
  const gaps: DistillGap[] = [];

  const pendingNow = new Set(await readLines(join(memoriesRoot, "pool", "pending.jsonl")));
  const archived = new Set(await readLines(join(memoriesRoot, "pool", "archived.jsonl")));
  for (const line of before.poolLines) {
    if (pendingNow.has(line) || !archived.has(line)) {
      gaps.push({ kind: "pool", id: poolLineId(line) });
    }
  }

  const pendingClarify = new Set(await listMarkdownIds(join(memoriesRoot, "clarify", "pending")));
  const history = new Set(await listMarkdownIds(join(memoriesRoot, "clarify", "history")));
  for (const id of before.clarifyIds) {
    if (pendingClarify.has(id) || !history.has(id) || (await clarifyHistoryMarkerGap(memoriesRoot, id))) {
      gaps.push({ kind: "clarify", id });
    }
  }

  const touchedByWeek = new Map<string, string[]>();
  const openByWeek = new Map<string, string[]>();
  for (const day of await listDayFiles(memoriesRoot)) {
    const info = await stat(day.path);
    const previous = before.dayMtimes.get(day.id);
    if (previous !== undefined && info.mtimeMs <= previous) continue;
    const weekId = dayToWeekId(day.id);
    const closed = weekDateRange(weekId).end < today;
    const bucket = closed ? touchedByWeek : openByWeek;
    const days = bucket.get(weekId) ?? [];
    days.push(day.id);
    bucket.set(weekId, days);
  }

  for (const [weekId, days] of touchedByWeek) {
    days.sort();
    if (await weekFileGap(memoriesRoot, weekId, days, false)) {
      gaps.push({ kind: "week", weekId, days, open: false });
    }
  }
  for (const [weekId, days] of openByWeek) {
    days.sort();
    if (await weekFileGap(memoriesRoot, weekId, days, true)) {
      gaps.push({ kind: "week", weekId, days, open: true });
    }
  }

  const touchedDays = await touchedDayIds(memoriesRoot, before);
  const months = new Map<string, { days: string[]; lowerMtime: number }>();
  for (const id of touchedDays) {
    const monthId = id.slice(0, 7);
    if (!monthClosed(monthId, today)) continue;
    const entry = months.get(monthId) ?? { days: [], lowerMtime: 0 };
    entry.days.push(id);
    const mtime = (await stat(join(memoriesRoot, "chain", "days", monthId, `${id}.md`))).mtimeMs;
    if (mtime > entry.lowerMtime) entry.lowerMtime = mtime;
    months.set(monthId, entry);
  }
  for (const [weekId, days] of touchedByWeek) {
    let weekMtime = 0;
    try {
      weekMtime = (await stat(join(memoriesRoot, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`))).mtimeMs;
    } catch {
      weekMtime = 0;
    }
    const { start, end } = weekDateRange(weekId);
    for (const monthId of new Set([start.slice(0, 7), end.slice(0, 7)])) {
      if (!monthClosed(monthId, today)) continue;
      const entry = months.get(monthId) ?? { days: [], lowerMtime: 0 };
      for (const id of days) {
        if (id.slice(0, 7) === monthId && !entry.days.includes(id)) entry.days.push(id);
      }
      if (weekMtime > entry.lowerMtime) entry.lowerMtime = weekMtime;
      months.set(monthId, entry);
    }
  }
  for (const [monthId, entry] of months) {
    entry.days.sort();
    let monthMtime = 0;
    try {
      monthMtime = (await stat(monthPath(memoriesRoot, monthId))).mtimeMs;
    } catch {
      monthMtime = 0;
    }
    if (monthMtime <= entry.lowerMtime) gaps.push({ kind: "month", monthId, days: entry.days });
  }

  const years = new Map<string, { days: string[]; lowerMtime: number }>();
  const noteYear = (yearId: string, dayId: string | null, lower: number) => {
    if (!(yearId < today.slice(0, 4))) return;
    const entry = years.get(yearId) ?? { days: [], lowerMtime: 0 };
    if (dayId && dayId.startsWith(yearId) && !entry.days.includes(dayId)) entry.days.push(dayId);
    if (lower > entry.lowerMtime) entry.lowerMtime = lower;
    years.set(yearId, entry);
  };
  for (const id of touchedDays) {
    const mtime = (await stat(join(memoriesRoot, "chain", "days", id.slice(0, 7), `${id}.md`))).mtimeMs;
    noteYear(id.slice(0, 4), id, mtime);
  }
  for (const [weekId, days] of touchedByWeek) {
    let weekMtime = 0;
    try {
      weekMtime = (await stat(join(memoriesRoot, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`))).mtimeMs;
    } catch {
      weekMtime = 0;
    }
    const { start, end } = weekDateRange(weekId);
    for (const yearId of new Set([start.slice(0, 4), end.slice(0, 4)])) {
      for (const id of days) noteYear(yearId, id, weekMtime);
      noteYear(yearId, null, weekMtime);
    }
  }
  for (const [monthId, entry] of months) {
    let monthMtime = 0;
    try {
      monthMtime = (await stat(monthPath(memoriesRoot, monthId))).mtimeMs;
    } catch {
      monthMtime = 0;
    }
    const lower = Math.max(monthMtime, entry.lowerMtime);
    for (const id of entry.days) noteYear(monthId.slice(0, 4), id, lower);
    noteYear(monthId.slice(0, 4), null, lower);
  }
  for (const id of await expiredFutureSightIds(memoriesRoot, today)) {
    gaps.push({ kind: "future", id });
  }

  for (const [yearId, entry] of years) {
    entry.days.sort();
    let yearMtime = 0;
    try {
      yearMtime = (await stat(join(memoriesRoot, "chain", "years", `${yearId}.md`))).mtimeMs;
    } catch {
      yearMtime = 0;
    }
    if (yearMtime <= entry.lowerMtime) gaps.push({ kind: "year", yearId, days: entry.days });
  }

  return gaps;
}

async function touchedDayIds(memoriesRoot: string, before: DistillSnapshot): Promise<string[]> {
  const ids: string[] = [];
  for (const day of await listDayFiles(memoriesRoot)) {
    const info = await stat(day.path);
    const previous = before.dayMtimes.get(day.id);
    if (previous !== undefined && info.mtimeMs <= previous) continue;
    ids.push(day.id);
  }
  return ids;
}

export async function expiredFutureSightIds(memoriesRoot: string, today: string): Promise<string[]> {
  const ids: string[] = [];
  for (const zone of ["upcoming", "longTerm"] as const) {
    let text = "";
    try {
      text = await readFile(join(memoriesRoot, "future-sight", `${zone}.md`), "utf8");
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    let anchors;
    try {
      anchors = parseZoneFile(text, zone);
    } catch {
      continue;
    }
    for (const anchor of anchors) {
      if (anchor.anchor_end < today) ids.push(anchor.id);
    }
  }
  return ids;
}

export function formatDistillGaps(gaps: DistillGap[]): string {
  if (gaps.length === 0) return "none";
  return gaps
    .map((gap) => {
      if (gap.kind === "pool") return `pool ${gap.id}`;
      if (gap.kind === "clarify") return `clarify ${gap.id}`;
      if (gap.kind === "week") {
        const mark = gap.open ? "open" : "closed";
        return `week ${gap.weekId} ${mark} (days ${gap.days.join(", ")})`;
      }
      if (gap.kind === "month") return `month ${gap.monthId} (days ${gap.days.join(", ")})`;
      if (gap.kind === "year") return `year ${gap.yearId} (days ${gap.days.join(", ")})`;
      return `future ${gap.id}`;
    })
    .join("; ");
}
