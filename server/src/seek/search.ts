/** Keyword search across short-term memory, L2 nodes, and memory-chain (day／week／month／year). */

import { readSummary, readAllNodeNotes } from "../store/memories/short-term-memory";
import { listChainDayIds, readDayForRecall } from "../store/memories/chain";
import {
  listMonthIds,
  listWeekIds,
  listYearIds,
  readHigherSummaryCurrent,
  type HigherChainLevel,
} from "../store/memories/chain-higher";
import { listNodeIds, readWhatCurrent } from "../store/memories/nodes";

export const SEARCH_SCOPES = ["l1", "nodes", "chain"] as const;
export type MemorySearchScope = (typeof SEARCH_SCOPES)[number];

export type NodeMatchReason = "node_id" | "what_content" | "l1_note";

export interface MemorySearchNodeHit {
  node: string;
  what_current: string;
  match_reason: NodeMatchReason;
}

export interface MemorySearchShortTermHit {
  summary: string | null;
  node_notes: Record<string, string>;
}

export interface MemorySearchChainHit {
  /** Present for day hits (compat). */
  day_id?: string;
  /** Stable id for this hit (day／week／month／year). */
  id: string;
  level: "day" | "week" | "month" | "year";
  content: string;
  source: "summary" | "ledger_fallback";
}

export interface MemorySearchResult {
  q: string;
  scope: MemorySearchScope[];
  nodes?: MemorySearchNodeHit[];
  l1?: MemorySearchShortTermHit | null;
  chain?: MemorySearchChainHit[];
}

function contains(text: string, qLower: string): boolean {
  return text.toLowerCase().includes(qLower);
}

/** Parse comma-separated scope query param; default all scopes when omitted. */
export function parseSearchScopes(
  raw: string | null,
): { scopes: MemorySearchScope[] } | { error: "invalid_scope" } {
  if (raw == null || raw.trim() === "") {
    return { scopes: [...SEARCH_SCOPES] };
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length === 0) {
    return { error: "invalid_scope" };
  }
  for (const part of unique) {
    if (!SEARCH_SCOPES.includes(part as MemorySearchScope)) {
      return { error: "invalid_scope" };
    }
  }
  return { scopes: unique as MemorySearchScope[] };
}

/** Search store for keyword hits. Caller must supply non-empty q. */
export async function searchMemory(
  q: string,
  scopes: MemorySearchScope[] = [...SEARCH_SCOPES],
): Promise<MemorySearchResult> {
  const query = q.trim();
  const qLower = query.toLowerCase();
  const result: MemorySearchResult = { q: query, scope: scopes };

  const needsShortTermStore = scopes.includes("l1") || scopes.includes("nodes");
  const summary = needsShortTermStore ? await readSummary() : "";
  const node_notes = needsShortTermStore ? await readAllNodeNotes() : {};

  if (scopes.includes("nodes")) {
    result.nodes = await matchNodes(qLower, node_notes);
  }
  if (scopes.includes("l1")) {
    result.l1 = matchShortTerm(summary, node_notes, qLower);
  }
  if (scopes.includes("chain")) {
    result.chain = await matchChain(qLower);
  }

  return result;
}

async function matchNodes(
  qLower: string,
  node_notes: Record<string, string>,
): Promise<MemorySearchNodeHit[]> {
  const ids = await listNodeIds();
  const out: MemorySearchNodeHit[] = [];

  for (const id of ids) {
    const idLower = id.toLowerCase();
    let reason: NodeMatchReason | null = null;

    if (qLower.includes(idLower) || idLower.includes(qLower)) {
      reason = "node_id";
    } else {
      const note = node_notes[id];
      if (note && contains(note, qLower)) {
        reason = "l1_note";
      } else {
        const what = await readWhatCurrent(id);
        if (contains(what, qLower)) reason = "what_content";
      }
    }

    if (reason) {
      out.push({
        node: id,
        what_current: await readWhatCurrent(id),
        match_reason: reason,
      });
    }
  }

  return out;
}

function matchShortTerm(
  summary: string,
  node_notes: Record<string, string>,
  qLower: string,
): MemorySearchShortTermHit | null {
  const summaryHit = summary.trim() && contains(summary, qLower) ? summary : null;
  const notes: Record<string, string> = {};
  for (const [node, note] of Object.entries(node_notes)) {
    if (note.trim() && contains(note, qLower)) notes[node] = note;
  }
  if (!summaryHit && Object.keys(notes).length === 0) return null;
  return { summary: summaryHit, node_notes: notes };
}

async function matchChain(qLower: string): Promise<MemorySearchChainHit[]> {
  const out: MemorySearchChainHit[] = [];
  for (const day_id of await listChainDayIds()) {
    const day = await readDayForRecall(day_id);
    if (day.source === "empty" || !contains(day.content, qLower)) continue;
    out.push({
      day_id,
      id: day_id,
      level: "day",
      content: day.content,
      source: day.source,
    });
  }

  async function matchHigher(level: HigherChainLevel, ids: string[]) {
    for (const id of ids) {
      const content = await readHigherSummaryCurrent(level, id);
      if (!content.trim() || !contains(content, qLower)) continue;
      out.push({ id, level, content, source: "summary" });
    }
  }

  await matchHigher("week", await listWeekIds());
  await matchHigher("month", await listMonthIds());
  await matchHigher("year", await listYearIds());
  return out;
}
