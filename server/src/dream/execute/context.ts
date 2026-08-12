/** Frozen context and retry feedback helpers for dream execution. */

import type { DreamContext, ReviewFeedback } from "../../agent/dream/types";
import { config } from "../../config";
import { draftSummary } from "../../store/dreams/draft";
import { draftDir, reportPath } from "../../store/dreams/dream-runs";
import { readPoolEntriesForScope } from "../../store/memories/short-term-memory";
import { calendarDate, nowIso } from "../../store/memories/activities";
import { readAllUnderstandings, listNodeIds } from "../../store/memories/nodes";
import { readDay, readDaySummary } from "../../store/memories/chain";
import { makeRunId } from "../../store/run-id";
import { parseMentions, mentionNodeIds } from "../../store/memories/mentions";

/** Compact one-line descriptions of draft changes for retry context. */
export function compactChangeLines(draft: Awaited<ReturnType<typeof draftSummary>>): string[] {
  if (!draft) return [];
  const lines: string[] = [];
  for (const d of draft.chain_summary_days) lines.push(`day summary ${d}`);
  for (const d of draft.chain_days) lines.push(`day ledger ${d}`);
  for (const id of draft.chain_weeks) lines.push(`week summary ${id}`);
  for (const id of draft.chain_months) lines.push(`month summary ${id}`);
  for (const id of draft.chain_years) lines.push(`year summary ${id}`);
  for (const id of draft.future_ids) lines.push(`future ${id}`);
  return lines;
}

/** Build a short previous-attempt summary for retry feedback. */
export function formatPreviousSummary(draft: Awaited<ReturnType<typeof draftSummary>>): string {
  const parts: string[] = [];
  if (draft) {
    parts.push(`draft entries: ${draft.entry_count}`);
    if (draft.chain_summary_days.length) parts.push(`day summaries: ${draft.chain_summary_days.join(", ")}`);
    if (draft.chain_days.length) parts.push(`day ledgers: ${draft.chain_days.join(", ")}`);
    if (draft.chain_weeks.length) parts.push(`weeks: ${draft.chain_weeks.join(", ")}`);
    if (draft.chain_months.length) parts.push(`months: ${draft.chain_months.join(", ")}`);
    if (draft.chain_years.length) parts.push(`years: ${draft.chain_years.join(", ")}`);
    if (draft.future_ids.length) parts.push(`futures: ${draft.future_ids.join(", ")}`);
  } else {
    parts.push("draft: (none)");
  }
  return parts.join("; ");
}

/** Create a collision-resistant identifier for a dream run. */
export function makeDreamRunId(at = nowIso()): string {
  return makeRunId("dream", at);
}

/** Build the frozen short-term, L2, and chain context supplied to a dream runner. */
export async function buildDreamContext(
  dreamRunId: string,
  scope: string[],
  reviewFeedback?: ReviewFeedback,
): Promise<DreamContext> {
  const scopeEntries = await readPoolEntriesForScope(scope);
  const events = scopeEntries.map((e) => ({
    id: e.id,
    ts: e.ts,
    raw: e.raw,
    mentions: parseMentions(e.raw).map((m) => ({ id: m.id, mode: m.mode })),
  }));
  const summary = scopeEntries.map((e) => `- [${e.ts}] (${e.id}) ${e.raw.trim()}`).join("\n");
  const node_notes: Record<string, string> = {};
  for (const e of scopeEntries) {
    for (const nodeId of mentionNodeIds(e.raw)) {
      const line = `- [${e.ts}] (${e.id}) ${e.raw.trim()}`;
      node_notes[nodeId] = node_notes[nodeId] ? `${node_notes[nodeId].trimEnd()}\n${line}` : line;
    }
  }
  for (const k of Object.keys(node_notes)) {
    node_notes[k] = node_notes[k].endsWith("\n") ? node_notes[k] : `${node_notes[k]}\n`;
  }

  const existing_nodes = await listNodeIds();
  const l2_current = await readAllUnderstandings();
  const today = calendarDate();
  const candidateDays = new Set<string>([today]);
  for (const e of events) candidateDays.add(calendarDate(e.ts));
  const days = [...candidateDays].sort();
  const chain_summaries_current: DreamContext["chain_summaries_current"] = [];
  const chain_ledgers: NonNullable<DreamContext["chain_ledgers"]> = [];
  for (const day of days) {
    chain_summaries_current.push({ day, current: await readDaySummary(day) });
    chain_ledgers.push({ day, content: await readDay(day) });
  }

  return {
    dream_run_id: dreamRunId,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    now: nowIso(),
    today,
    scope,
    l1: { summary: summary ? `${summary}\n` : "", node_notes },
    events,
    l2_current,
    existing_nodes,
    chain_summaries_current,
    chain_ledgers,
    store_dir: config.storeDir,
    draft_dir: draftDir(dreamRunId),
    report_path: reportPath(dreamRunId),
    ...(reviewFeedback ? { review_feedback: reviewFeedback } : {}),
  };
}

/** @deprecated Use buildDreamContext. */
export const buildExtractContext = buildDreamContext;
