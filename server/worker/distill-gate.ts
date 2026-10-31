import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { dayToWeekId, weekDateRange, weekMonthKey } from "../chain/time.ts";

/** Lines and clarify ids present when Session A starts, plus day mtimes. */
export type DistillSnapshot = {
  poolLines: string[];
  clarifyIds: string[];
  dayMtimes: Map<string, number>;
};

export type DistillGap =
  | { kind: "pool"; id: string }
  | { kind: "clarify"; id: string }
  | { kind: "week"; weekId: string; days: string[] };

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

/**
 * Mechanical leftovers after Session A stops.
 * Week files are required only for days created or rewritten in this run whose ISO week has ended
 * (local today is after that week's Sunday).
 */
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
    if (pendingClarify.has(id) || !history.has(id)) {
      gaps.push({ kind: "clarify", id });
    }
  }

  const touchedByWeek = new Map<string, string[]>();
  for (const day of await listDayFiles(memoriesRoot)) {
    const info = await stat(day.path);
    const previous = before.dayMtimes.get(day.id);
    if (previous !== undefined && info.mtimeMs <= previous) continue;
    const weekId = dayToWeekId(day.id);
    if (!(weekDateRange(weekId).end < today)) continue;
    const days = touchedByWeek.get(weekId) ?? [];
    days.push(day.id);
    touchedByWeek.set(weekId, days);
  }

  for (const [weekId, days] of touchedByWeek) {
    days.sort();
    const weekPath = join(memoriesRoot, "chain", "weeks", weekMonthKey(weekId), `${weekId}.md`);
    let weekMtime = 0;
    try {
      weekMtime = (await stat(weekPath)).mtimeMs;
    } catch {
      weekMtime = 0;
    }
    let newest = 0;
    for (const id of days) {
      const path = join(memoriesRoot, "chain", "days", id.slice(0, 7), `${id}.md`);
      const mtime = (await stat(path)).mtimeMs;
      if (mtime > newest) newest = mtime;
    }
    if (weekMtime <= newest) gaps.push({ kind: "week", weekId, days });
  }

  return gaps;
}

export function formatDistillGaps(gaps: DistillGap[]): string {
  if (gaps.length === 0) return "none";
  return gaps
    .map((gap) => {
      if (gap.kind === "pool") return `pool ${gap.id}`;
      if (gap.kind === "clarify") return `clarify ${gap.id}`;
      return `week ${gap.weekId} (days ${gap.days.join(", ")})`;
    })
    .join("; ");
}
