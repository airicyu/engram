/** GET /memories/short-term-memory — short-term pool records for Activities. */

import { isShortTermMemoryEmpty, readPoolEntries, type PoolEntry } from "../../store/memories/short-term-memory";

/** Short-term-only snapshot (no chain / L2 nodes). */
export interface ShortTermMemoryPacket {
  entries: PoolEntry[];
  present: boolean;
}

/** Build the short-term preview packet. */
export async function handleShortTermMemory(): Promise<ShortTermMemoryPacket> {
  const entries = await readPoolEntries();
  const l1Empty = await isShortTermMemoryEmpty();
  return {
    entries,
    present: !l1Empty,
  };
}
