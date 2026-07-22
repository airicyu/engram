/** Shared contracts for agents that extract dream patches from memory context. */

import type { Patch } from "../dream/schema";

/** Frozen memory context supplied to an extraction agent. */
export interface ExtractContext {
  dream_run_id: string;
  timezone: string;
  /** Frozen L1 event ids for this dream (S). Events may span multiple calendar days. */
  scope: string[];
  l1: { summary: string; node_notes: Record<string, string> };
  events: Array<{ id: string; ts: string; raw: string; node_refs?: string[] }>;
  l2_current: Array<{ node: string; what_current: string }>;
  existing_nodes: string[];
  /**
   * Day-chain summary Current for candidate occurrence days (encoding days from
   * scoped events + today). Empty string = no summary yet → use init.
   */
  chain_summaries_current: Array<{ day: string; current: string }>;
  /** Optional ledger full text for the same days (debug / human review). */
  chain_ledgers?: Array<{ day: string; content: string }>;
}

/** Runner capable of extracting proposed patches from a context snapshot. */
export interface AgentRunner {
  extract(ctx: ExtractContext): Promise<Patch[]>;
}
