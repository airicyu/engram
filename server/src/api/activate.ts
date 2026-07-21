import { readSummary, readAllNodeNotes, isL1Empty } from "../store/l1";
import { readDay } from "../store/chain";
import { listNodeIds, readWhatCurrent } from "../store/nodes";
import { taipeiDate } from "../store/events";
import { computeDreamStatus } from "../dream/run";

export interface ActivationPacket {
  query: string | null;
  sources: Array<"L1" | "L2" | "chain" | "gap">;
  dream_status: "ok" | "dead_letter_pending" | "dream_incomplete" | "never_dreamed";
  l1: {
    summary: string;
    node_notes: Record<string, string>;
    present: boolean;
  };
  chain: {
    day_id: string;
    content: string;
  };
  nodes: Array<{
    node: string;
    what_current: string;
    match_reason: string;
  }>;
}

export async function handleActivate(q: string | null): Promise<ActivationPacket> {
  const sources: ActivationPacket["sources"] = [];
  const dream_status = await computeDreamStatus();
  const l1Empty = await isL1Empty();
  const summary = await readSummary();
  const node_notes = await readAllNodeNotes();

  if (!l1Empty) sources.push("L1");

  const day_id = taipeiDate();
  const dayContent = await readDay(day_id);
  if (dayContent.trim()) sources.push("chain");

  const query = q?.trim() || null;
  const matched = await matchNodes(query, node_notes);
  if (matched.length > 0) sources.push("L2");
  if (query && matched.length === 0 && l1Empty && !dayContent.trim()) {
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
      content: dayContent,
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
