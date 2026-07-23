/** GET /memory/l1 — short-term pool preview for Capture. */

import { readSummary, readAllNodeNotes, isL1Empty } from "../../store/l1";

/** L1-only snapshot (no chain / nodes). */
export interface MemoryL1Packet {
  summary: string;
  node_notes: Record<string, string>;
  present: boolean;
}

/** Build the L1 preview packet. */
export async function handleMemoryL1(): Promise<MemoryL1Packet> {
  const l1Empty = await isL1Empty();
  return {
    summary: await readSummary(),
    node_notes: await readAllNodeNotes(),
    present: !l1Empty,
  };
}
