/** Recall API handler that composes L1, L2, and memory-chain context. */

import { readSummary, readAllNodeNotes, isL1Empty } from "../store/l1";
import { readDayForRecall } from "../store/chain";
import { listNodeIds, readWhatCurrent } from "../store/nodes";
import { calendarDate } from "../store/events";
import { computeDreamStatus, type DreamStatus } from "../dream/run";

/** Context packet returned from GET /recall. */
export interface RecallPacket {
  query: string | null;
  sources: Array<"L1" | "L2" | "chain" | "gap">;
  dream_status: DreamStatus;
  l1: {
    summary: string;
    node_notes: Record<string, string>;
    present: boolean;
  };
  chain: {
    day_id: string;
    content: string;
    /** Prefer summary; ledger_fallback only when no summary file/Current. */
    source: "summary" | "ledger_fallback" | "empty";
  };
  nodes: Array<{
    node: string;
    what_current: string;
    match_reason: string;
  }>;
}

/** Build a recall packet for an optional query. */
export async function handleRecall(q: string | null): Promise<RecallPacket> {
  const sources: RecallPacket["sources"] = [];
  const dream_status = await computeDreamStatus();
  const l1Empty = await isL1Empty();
  const summary = await readSummary();
  const node_notes = await readAllNodeNotes();

  if (!l1Empty) sources.push("L1");

  const day_id = calendarDate();
  const day = await readDayForRecall(day_id);
  if (day.content.trim()) sources.push("chain");

  const query = q?.trim() || null;
  const matched = await matchNodes(query, node_notes);
  if (matched.length > 0) sources.push("L2");
  if (query && matched.length === 0 && l1Empty && !day.content.trim()) {
    sources.push("gap");
  }

  return {
    query,
    sources,
    dream_status,
    l1: {
      summary,
      node_notes,
      present: !l1Empty,
    },
    chain: {
      day_id,
      content: day.content,
      source: day.source,
    },
    nodes: matched,
  };
}

async function matchNodes(
  query: string | null,
  node_notes: Record<string, string>,
): Promise<Array<{ node: string; what_current: string; match_reason: string }>> {
  const ids = await listNodeIds();
  const out: Array<{ node: string; what_current: string; match_reason: string }> = [];
  const q = query?.toLowerCase() ?? "";

  for (const id of ids) {
    let reason: string | null = null;
    if (!query) {
      // no query: include all nodes that have Current or L1 notes (prototype ≤3)
      reason = "all_nodes";
    } else if (q.includes(id.toLowerCase()) || id.toLowerCase().includes(q)) {
      reason = "keyword";
    } else if (node_notes[id]) {
      reason = "node_refs_l1";
    } else {
      const what = await readWhatCurrent(id);
      if (what.toLowerCase().includes(q)) reason = "what_content";
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
