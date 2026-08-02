/** GET /memories/short-term-memory — short-term pool preview for Activities. */

import { readSummary, readAllNodeNotes, isShortTermMemoryEmpty } from "../../store/memories/short-term-memory";

/** Short-term-only snapshot (no chain / nodes). */
export interface ShortTermMemoryPacket {
  summary: string;
  node_notes: Record<string, string>;
  present: boolean;
}

/** Build the short-term preview packet. */
export async function handleShortTermMemory(): Promise<ShortTermMemoryPacket> {
  const l1Empty = await isShortTermMemoryEmpty();
  return {
    summary: await readSummary(),
    node_notes: await readAllNodeNotes(),
    present: !l1Empty,
  };
}
