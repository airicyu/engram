/** Contracts for memory ask agents. */

/** Parsed JSON output from a memory ask agent. */
export interface AskAnswer {
  answer: string;
  sources: Array<{
    kind: string;
    node?: string;
    day_id?: string;
    /** Future-sight item id when kind is future_sight. */
    id?: string;
    /** Future-sight zone when kind is future_sight. */
    zone?: string;
    reason?: string;
  }>;
  confidence?: string;
}

/** Input passed to a memory ask runner. */
export interface AskInput {
  job_id: string;
  q: string;
  store_dir: string;
  timezone: string;
  /** Effective memory write language: zh-Hant | zh-Hans | en. */
  memory_language: string;
  dream_status: string;
  /** Memory-timeline "now" (virtual clock aware). */
  now: string;
  /** Memory-timeline calendar day YYYY-MM-DD. */
  today: string;
}

/** Runner capable of answering a natural-language question from the store. */
export interface MemoryAskRunner {
  ask(input: AskInput): Promise<AskAnswer>;
}
