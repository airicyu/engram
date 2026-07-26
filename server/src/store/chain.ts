/** Read access for daily memory-chain ledgers and summaries. */

import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homePath } from "./home";
import { extractCurrentSection } from "./nodes";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const DAY_ID_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM` parent folder for a day id. */
export function dayMonthKey(dayId: string): string {
  if (!DAY_ID_RE.test(dayId)) {
    throw new Error(`invalid day id: ${dayId}`);
  }
  return dayId.slice(0, 7);
}

/** Relative ledger path under ENGRAM_STORE_DIR. */
export function dayLedgerRel(dayId: string): string {
  return `memories/chain/days/${dayMonthKey(dayId)}/${dayId}.md`;
}

/** Relative summary path under ENGRAM_STORE_DIR. */
export function daySummaryRel(dayId: string): string {
  return `memories/chain/days/${dayMonthKey(dayId)}/${dayId}.summary.md`;
}

/** Absolute ledger path. */
export function dayLedgerPath(dayId: string): string {
  return homePath("memories", "chain", "days", dayMonthKey(dayId), `${dayId}.md`);
}

/** Absolute summary path. */
export function daySummaryPath(dayId: string): string {
  return homePath("memories", "chain", "days", dayMonthKey(dayId), `${dayId}.summary.md`);
}

/** Ledger: append-only patch blocks. */
export async function readDay(dayId: string): Promise<string> {
  const p = dayLedgerPath(dayId);
  if (!(await exists(p))) return "";
  return readFile(p, "utf8");
}

/** Full summary markdown (`## Current` + `## History`), or "" if missing. */
export async function readDaySummaryFile(dayId: string): Promise<string> {
  const p = daySummaryPath(dayId);
  if (!(await exists(p))) return "";
  return readFile(p, "utf8");
}

/** Summary Current section only, or "" if missing / empty. */
export async function readDaySummary(dayId: string): Promise<string> {
  const file = await readDaySummaryFile(dayId);
  if (!file.trim()) return "";
  return extractCurrentSection(file);
}

/**
 * Recall / display: prefer summary Current; fallback to ledger when no summary
 * (legacy transition). Returns which source was used.
 */
export async function readDayForRecall(
  dayId: string,
): Promise<{ content: string; source: "summary" | "ledger_fallback" | "empty" }> {
  const summary = await readDaySummary(dayId);
  if (summary.trim()) {
    return { content: summary, source: "summary" };
  }
  const ledger = await readDay(dayId);
  if (ledger.trim()) {
    return { content: ledger, source: "ledger_fallback" };
  }
  return { content: "", source: "empty" };
}

/** Distinct YYYY-MM-DD ids under memory-chain/days/YYYY-MM/, newest first. */
export async function listChainDayIds(): Promise<string[]> {
  const dir = homePath("memories", "chain", "days");
  try {
    const ids = new Set<string>();
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || !/^\d{4}-\d{2}$/.test(e.name)) continue;
      const files = await readdir(join(dir, e.name));
      for (const f of files) {
        const m = f.match(/^(\d{4}-\d{2}-\d{2})(?:\.summary)?\.md$/);
        if (m) ids.add(m[1]);
      }
    }
    return [...ids].sort().reverse();
  } catch {
    return [];
  }
}
