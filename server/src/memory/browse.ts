/** Browse index/detail for memory chain days and L2 nodes. */

import { listChainDayIds, readDayForRecall } from "../store/chain";
import { listNodeIds, nodeExists, readWhatCurrent } from "../store/nodes";

const PREVIEW_MAX = 80;

export function previewText(text: string, max = PREVIEW_MAX): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

export function isValidDayId(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id);
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

export async function listNodesIndex(): Promise<{
  nodes: Array<{ node: string; preview: string }>;
  present: boolean;
}> {
  const ids = await listNodeIds();
  const nodes: Array<{ node: string; preview: string }> = [];
  for (const node of ids) {
    const what = await readWhatCurrent(node);
    nodes.push({ node, preview: previewText(what) });
  }
  return { nodes, present: nodes.length > 0 };
}

export async function getNodeDetail(nodeId: string): Promise<{
  node: string;
  what_current: string | null;
  present: boolean;
}> {
  const exists = await nodeExists(nodeId);
  if (!exists) {
    return { node: nodeId, what_current: null, present: false };
  }
  const what_current = await readWhatCurrent(nodeId);
  return { node: nodeId, what_current, present: true };
}
