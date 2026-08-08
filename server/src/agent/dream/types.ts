/** Shared contracts for dream file-pipeline agents (0.16). */

/** Human feedback from a discarded pending run, injected on retry. */
export interface ReviewFeedback {
  reason: string;
  /** Compact draft／report summary of the previous attempt. */
  previous_summary: string;
  /** One-line summaries of previous touched paths (or legacy patch lines). */
  previous_changes: string[];
  /** Discarded dream_run_id this retry replaces. */
  retried_from: string;
}

/** Frozen memory context supplied to a dream agent. */
export interface DreamContext {
  dream_run_id: string;
  timezone: string;
  /** Effective memory write language: zh-Hant | zh-Hans | en. */
  memory_language: string;
  /** Memory-timeline "now" (virtual clock aware). ISO-8601 with offset. */
  now: string;
  /** Memory-timeline calendar day YYYY-MM-DD (virtual clock aware). */
  today: string;
  /** Frozen short-term event ids for this dream (S). */
  scope: string[];
  /** Frozen short-term pool view. JSON key `l1` is frozen (agent context wire). */
  l1: { summary: string; node_notes: Record<string, string> };
  events: Array<{ id: string; ts: string; raw: string; node_refs?: string[] }>;
  /** Live node understandings: `understanding` = whole `what.md` (standing understanding). */
  l2_current: Array<{ node: string; understanding: string }>;
  existing_nodes: string[];
  /**
   * Day-chain summary body for candidate occurrence days.
   * Empty string = no summary yet.
   */
  chain_summaries_current: Array<{ day: string; current: string }>;
  /** Optional ledger full text for the same days. */
  chain_ledgers?: Array<{ day: string; content: string }>;
  /** Absolute ENGRAM_STORE_DIR. */
  store_dir: string;
  /** Absolute path to dreams/draft/{run_id}/. */
  draft_dir: string;
  /** Absolute path to dreams/reports/{run_id}.md. */
  report_path: string;
  /** Present on retry-with-reason; absent on a fresh dream/run. */
  review_feedback?: ReviewFeedback;
}

/** @deprecated Use DreamContext — alias kept for transitional imports. */
export type ExtractContext = DreamContext;

/** Context for amend-dream: same pending run, free-form instruction, no full re-extract. */
export interface AmendContext {
  dream_run_id: string;
  instruction: string;
  timezone: string;
  memory_language: string;
  now: string;
  today: string;
  scope: string[];
  /** Compact orientation of paths already in this pending draft. */
  draft_summary: string;
  store_dir: string;
  draft_dir: string;
  report_path: string;
}

/** Runner that edits draft files and writes the dream report (no typed Patch[]). */
export interface AgentRunner {
  dream(ctx: DreamContext): Promise<void>;
  /** Minimal same-run_id draft edit while pending (0.27+). */
  amend(ctx: AmendContext): Promise<void>;
}
