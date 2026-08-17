/** GET /memories/nodes/graph — L2 node index plus undirected P1 wikilink edges. */

import { access, readFile } from "node:fs/promises";
import { isValidNodeId, listNodesIndex } from "./browse";
import { understandingPath } from "../store/memories/nodes";

/** P1: `[[nodes/{id}/{id}|label]]` or `[[nodes/{id}/{id}]]`. */
const NODE_WIKILINK_RE = /\[\[nodes\/([^/\]]+)\/\1(?:\|[^\]]*)?\]\]/g;

export type NodeGraphNode = {
  node: string;
  preview: string;
  score: number | null;
  display_score: number | null;
};

export type NodeGraphEdge = {
  a: string;
  b: string;
  refs: number;
  level: number;
};

export type NodeGraphBody = {
  present: boolean;
  nodes: NodeGraphNode[];
  edges: NodeGraphEdge[];
};

/** `level = clamp(max(1, ceil(log2(refs))), 1, 10)` for refs ≥ 1. */
export function graphEdgeLevel(refs: number): number {
  if (refs < 1) return 1;
  return Math.min(10, Math.max(1, Math.ceil(Math.log2(refs))));
}

export function countP1WikilinkTargets(md: string): Map<string, number> {
  const counts = new Map<string, number>();
  NODE_WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NODE_WIKILINK_RE.exec(md)) !== null) {
    const id = m[1]!;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

async function mdExists(nodeId: string): Promise<boolean> {
  try {
    await access(understandingPath(nodeId));
    return true;
  } catch {
    return false;
  }
}

export async function listNodesGraph(): Promise<NodeGraphBody> {
  const index = await listNodesIndex();
  const liveMd = new Set<string>();
  for (const n of index.nodes) {
    if (await mdExists(n.node)) liveMd.add(n.node);
  }

  const directed = new Map<string, number>();
  const bump = (from: string, to: string, n: number) => {
    const key = `${from}\0${to}`;
    directed.set(key, (directed.get(key) ?? 0) + n);
  };

  for (const from of liveMd) {
    const md = await readFile(understandingPath(from), "utf8");
    const counts = countP1WikilinkTargets(md);
    for (const [to, n] of counts) {
      if (!isValidNodeId(to)) continue;
      if (to === from) continue;
      if (!liveMd.has(to)) continue;
      bump(from, to, n);
    }
  }

  const pairRefs = new Map<string, number>();
  for (const [key, n] of directed) {
    const sep = key.indexOf("\0");
    const from = key.slice(0, sep);
    const to = key.slice(sep + 1);
    const a = from < to ? from : to;
    const b = from < to ? to : from;
    const pair = `${a}\0${b}`;
    pairRefs.set(pair, (pairRefs.get(pair) ?? 0) + n);
  }

  const edges: NodeGraphEdge[] = [];
  for (const [pair, refs] of pairRefs) {
    if (refs < 1) continue;
    const sep = pair.indexOf("\0");
    const a = pair.slice(0, sep);
    const b = pair.slice(sep + 1);
    edges.push({ a, b, refs, level: graphEdgeLevel(refs) });
  }
  edges.sort((x, y) => (x.a === y.a ? x.b.localeCompare(y.b) : x.a.localeCompare(y.a)));

  return {
    present: index.present,
    nodes: index.nodes,
    edges,
  };
}
