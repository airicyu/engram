/** Keyword search across short-term memory, L2 nodes, memory-chain, and future-sight. */

import { readPoolEntries, type PoolEntry } from "../store/memories/short-term-memory";
import { listChainDayIds, readDayForRecall } from "../store/memories/chain";
import {
  listMonthIds,
  listWeekIds,
  listYearIds,
  readHigherSummaryCurrent,
  type HigherChainLevel,
} from "../store/memories/chain-higher";
import { listNodeIds, readUnderstanding } from "../store/memories/nodes";
import {
  listAnchors,
  type FutureSightListedAnchor,
  type FutureSightZone,
} from "../store/memories/future-sight";

export const SEARCH_SCOPES = ["l1", "nodes", "chain", "future"] as const;
export type MemorySearchScope = (typeof SEARCH_SCOPES)[number];

export type NodeMatchReason = "node_id" | "what_content";

export type FutureSightMatchReason = "id" | "content" | "anchor";

export interface MemorySearchNodeHit {
  node: string;
  understanding: string;
  match_reason: NodeMatchReason;
}

export interface MemorySearchShortTermHit {
  entries: PoolEntry[];
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

export interface MemorySearchFutureSightHit {
  id: string;
  zone: FutureSightZone;
  anchor_start: string;
  anchor_end: string;
  content: string;
  match_reason: FutureSightMatchReason;
}

export interface MemorySearchResult {
  q: string;
  scope: MemorySearchScope[];
  nodes?: MemorySearchNodeHit[];
  l1?: MemorySearchShortTermHit | null;
  chain?: MemorySearchChainHit[];
  future_sight?: MemorySearchFutureSightHit[];
}

const FUTURE_CONTENT_MAX = 2000;

function contains(text: string, qLower: string): boolean {
  return text.toLowerCase().includes(qLower);
}

function truncateContent(text: string): string {
  if (text.length <= FUTURE_CONTENT_MAX) return text;
  return `${text.slice(0, FUTURE_CONTENT_MAX)}…`;
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

  if (scopes.includes("nodes")) {
    result.nodes = await matchNodes(qLower);
  }
  if (scopes.includes("l1")) {
    result.l1 = matchShortTerm(await readPoolEntries(), qLower);
  }
  if (scopes.includes("chain")) {
    result.chain = await matchChain(qLower);
  }
  if (scopes.includes("future")) {
    result.future_sight = await matchFutureSight(qLower);
  }

  return result;
}

async function matchNodes(qLower: string): Promise<MemorySearchNodeHit[]> {
  const ids = await listNodeIds();
  const out: MemorySearchNodeHit[] = [];

  for (const id of ids) {
    const idLower = id.toLowerCase();
    let reason: NodeMatchReason | null = null;

    if (qLower.includes(idLower) || idLower.includes(qLower)) {
      reason = "node_id";
    } else {
      const what = await readUnderstanding(id);
      if (contains(what, qLower)) reason = "what_content";
    }

    if (reason) {
      out.push({
        node: id,
        understanding: await readUnderstanding(id),
        match_reason: reason,
      });
    }
  }

  return out;
}

function matchShortTerm(entries: PoolEntry[], qLower: string): MemorySearchShortTermHit | null {
  const hits = entries.filter(
    (e) => contains(e.raw, qLower) || contains(e.id, qLower),
  );
  if (hits.length === 0) return null;
  return { entries: hits };
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

function matchOneFutureSight(
  a: FutureSightListedAnchor,
  qLower: string,
): MemorySearchFutureSightHit | null {
  let reason: FutureSightMatchReason | null = null;
  if (contains(a.id, qLower)) reason = "id";
  else if (contains(a.content, qLower)) reason = "content";
  else if (contains(a.anchor_start, qLower) || contains(a.anchor_end, qLower)) {
    reason = "anchor";
  }
  if (!reason) return null;
  return {
    id: a.id,
    zone: a.zone,
    anchor_start: a.anchor_start,
    anchor_end: a.anchor_end,
    content: truncateContent(a.content),
    match_reason: reason,
  };
}

/** Keyword hits across hot.md + later.md (hot first, then later; each zone already near→far). */
async function matchFutureSight(qLower: string): Promise<MemorySearchFutureSightHit[]> {
  const anchors = await listAnchors();
  const out: MemorySearchFutureSightHit[] = [];
  for (const a of anchors) {
    const hit = matchOneFutureSight(a, qLower);
    if (hit) out.push(hit);
  }
  return out;
}
