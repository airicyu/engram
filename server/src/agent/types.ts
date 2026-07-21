import type { Patch } from "../dream/schema";

export interface ExtractContext {
  dream_run_id: string;
  timezone: "Asia/Taipei";
  /** Frozen L1 event ids for this dream (S). Events may span multiple calendar days. */
  scope: string[];
  l1: { summary: string; node_notes: Record<string, string> };
  events: Array<{ id: string; ts: string; raw: string; node_refs?: string[] }>;
  l2_current: Array<{ node: string; what_current: string }>;
  existing_nodes: string[];
}

export interface AgentRunner {
  extract(ctx: ExtractContext): Promise<Patch[]>;
}
