/** Browse index/detail for memory chain days/weeks/months/years and L2 nodes. */

import { listChainDayIds, readDayForRecall } from "../store/memories/chain";
import {
  listMonthIds,
  listWeekIds,
  listYearIds,
  readHigherSummaryCurrent,
  type HigherChainLevel,
} from "../store/memories/chain-higher";
import {
  isValidDayId as validDay,
  isValidMonthId,
  isValidWeekId,
  isValidYearId,
  weekDateRange,
} from "../store/memories/chain-time";
import { listNodeIds, nodeExists, readUnderstanding } from "../store/memories/nodes";
import {
  displayScore,
  readNodeScore,
  readRegistry,
} from "../store/memories/node-score";

const PREVIEW_MAX = 80;

export function previewText(text: string, max = PREVIEW_MAX): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

export function isValidDayId(id: string): boolean {
  return validDay(id);
}

export function isValidWeekIdBrowse(id: string): boolean {
  return isValidWeekId(id);
}

export function isValidMonthIdBrowse(id: string): boolean {
  return isValidMonthId(id);
}

export function isValidYearIdBrowse(id: string): boolean {
  return isValidYearId(id);
}

export function isValidNodeId(id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return true;
}

export async function listChainIndex(): Promise<{
  days: Array<{ day_id: string; preview: string; source: "summary" | "ledger_fallback" }>;
  present: boolean;
}> {
  const ids = await listChainDayIds();
  const days: Array<{ day_id: string; preview: string; source: "summary" | "ledger_fallback" }> = [];
  for (const day_id of ids) {
    const { content, source } = await readDayForRecall(day_id);
    if (source === "empty") continue;
    days.push({
      day_id,
      preview: previewText(content),
      source,
    });
  }
  return { days, present: days.length > 0 };
}

export async function getChainDay(dayId: string): Promise<{
  day_id: string;
  content: string | null;
  source: "summary" | "ledger_fallback" | "empty";
  present: boolean;
}> {
  const { content, source } = await readDayForRecall(dayId);
  if (source === "empty") {
    return { day_id: dayId, content: null, source: "empty", present: false };
  }
  return { day_id: dayId, content, source, present: true };
}

async function listHigherIndex(level: HigherChainLevel): Promise<{
  items: Array<{ id: string; preview: string }>;
  present: boolean;
}> {
  const ids =
    level === "week"
      ? await listWeekIds()
      : level === "month"
        ? await listMonthIds()
        : await listYearIds();
  const items: Array<{ id: string; preview: string }> = [];
  for (const id of ids) {
    const current = await readHigherSummaryCurrent(level, id);
    if (!current.trim()) continue;
    items.push({ id, preview: previewText(current) });
  }
  return { items, present: items.length > 0 };
}

async function getHigherDetail(
  level: HigherChainLevel,
  id: string,
): Promise<{ id: string; content: string | null; present: boolean }> {
  const current = await readHigherSummaryCurrent(level, id);
  if (!current.trim()) {
    return { id, content: null, present: false };
  }
  return { id, content: current, present: true };
}

export async function listWeekIndex() {
  const { items, present } = await listHigherIndex("week");
  return {
    weeks: items.map((x) => {
      const { start, end } = weekDateRange(x.id);
      return { week_id: x.id, start, end, preview: x.preview };
    }),
    present,
  };
}

export async function getChainWeek(weekId: string) {
  const d = await getHigherDetail("week", weekId);
  const { start, end } = weekDateRange(weekId);
  return { week_id: d.id, start, end, content: d.content, present: d.present };
}

export async function listMonthIndex() {
  const { items, present } = await listHigherIndex("month");
  return {
    months: items.map((x) => ({ month_id: x.id, preview: x.preview })),
    present,
  };
}

export async function getChainMonth(monthId: string) {
  const d = await getHigherDetail("month", monthId);
  return { month_id: d.id, content: d.content, present: d.present };
}

export async function listYearIndex() {
  const { items, present } = await listHigherIndex("year");
  return {
    years: items.map((x) => ({ year_id: x.id, preview: x.preview })),
    present,
  };
}

export async function getChainYear(yearId: string) {
  const d = await getHigherDetail("year", yearId);
  return { year_id: d.id, content: d.content, present: d.present };
}

export async function listNodesIndex(): Promise<{
  nodes: Array<{
    node: string;
    preview: string;
    score: number | null;
    display_score: number | null;
  }>;
  present: boolean;
}> {
  const ids = await listNodeIds();
  const reg = await readRegistry();
  const maxScore = reg?.max_score ?? null;
  const nodes: Array<{
    node: string;
    preview: string;
    score: number | null;
    display_score: number | null;
  }> = [];
  for (const node of ids) {
    const what = await readUnderstanding(node);
    const scoreFile = await readNodeScore(node);
    const score = scoreFile?.score ?? null;
    nodes.push({
      node,
      preview: previewText(what),
      score,
      display_score: score == null ? null : displayScore(score, maxScore),
    });
  }
  return { nodes, present: nodes.length > 0 };
}

export async function getNodeDetail(nodeId: string): Promise<{
  node: string;
  understanding: string | null;
  present: boolean;
  score: number | null;
  display_score: number | null;
  score_timestamp: string | null;
}> {
  const exists = await nodeExists(nodeId);
  if (!exists) {
    return {
      node: nodeId,
      understanding: null,
      present: false,
      score: null,
      display_score: null,
      score_timestamp: null,
    };
  }
  const understanding = await readUnderstanding(nodeId);
  const scoreFile = await readNodeScore(nodeId);
  const reg = await readRegistry();
  const score = scoreFile?.score ?? null;
  return {
    node: nodeId,
    understanding,
    present: true,
    score,
    display_score: score == null ? null : displayScore(score, reg?.max_score ?? null),
    score_timestamp: scoreFile?.score_timestamp ?? null,
  };
}
