/** Keyword search across L1, L2 nodes, and memory-chain days. */

import { readSummary, readAllNodeNotes } from "../store/l1";
import { listChainDayIds, readDayForRecall } from "../store/chain";
import { listNodeIds, readWhatCurrent } from "../store/nodes";

export const SEARCH_SCOPES = ["l1", "nodes", "chain"] as const;
export type MemorySearchScope = (typeof SEARCH_SCOPES)[number];

export type NodeMatchReason = "node_id" | "what_content" | "l1_note";

export interface MemorySearchNodeHit {
  node: string;
  what_current: string;
  match_reason: NodeMatchReason;
}

export interface MemorySearchL1Hit {
  summary: string | null;
  node_notes: Record<string, string>;
}

export interface MemorySearchChainHit {
  day_id: string;
  content: string;
  source: "summary" | "ledger_fallback";
}

export interface MemorySearchResult {
  q: string;
  scope: MemorySearchScope[];
  nodes?: MemorySearchNodeHit[];
  l1?: MemorySearchL1Hit | null;
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

  const needsL1Store = scopes.includes("l1") || scopes.includes("nodes");
  const summary = needsL1Store ? await readSummary() : "";
  const node_notes = needsL1Store ? await readAllNodeNotes() : {};

  if (scopes.includes("nodes")) {
    result.nodes = await matchNodes(qLower, node_notes);
  }
  if (scopes.includes("l1")) {
    result.l1 = matchL1(summary, node_notes, qLower);
  }
  if (scopes.includes("chain")) {
    result.chain = await matchChainDays(qLower);
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

function matchL1(
  summary: string,
  node_notes: Record<string, string>,
  qLower: string,
): MemorySearchL1Hit | null {
  const summaryHit = summary.trim() && contains(summary, qLower) ? summary : null;
  const notes: Record<string, string> = {};
  for (const [node, note] of Object.entries(node_notes)) {
    if (note.trim() && contains(note, qLower)) notes[node] = note;
  }
  if (!summaryHit && Object.keys(notes).length === 0) return null;
  return { summary: summaryHit, node_notes: notes };
}

async function matchChainDays(qLower: string): Promise<MemorySearchChainHit[]> {
  const out: MemorySearchChainHit[] = [];
  for (const day_id of await listChainDayIds()) {
    const day = await readDayForRecall(day_id);
    if (day.source === "empty" || !contains(day.content, qLower)) continue;
    out.push({
      day_id,
      content: day.content,
      source: day.source,
    });
  }
  return out;
}
