/** Read access for daily memory-chain ledgers and summaries. */

import { access, readFile } from "node:fs/promises";
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

function dayPath(dayId: string): string {
  return homePath("memory-chain", "days", `${dayId}.md`);
}

function summaryPath(dayId: string): string {
  return homePath("memory-chain", "days", `${dayId}.summary.md`);
}

/** Ledger: append-only patch blocks. */
export async function readDay(dayId: string): Promise<string> {
  const p = dayPath(dayId);
  if (!(await exists(p))) return "";
  return readFile(p, "utf8");
}

/** Full summary markdown (`## Current` + `## History`), or "" if missing. */
export async function readDaySummaryFile(dayId: string): Promise<string> {
  const p = summaryPath(dayId);
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
