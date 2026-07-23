/** Contracts for memory ask agents. */

/** Parsed JSON output from a memory ask agent. */
export interface AskAnswer {
  answer: string;
  sources: Array<{
    kind: string;
    node?: string;
    day_id?: string;
    reason?: string;
  }>;
  confidence?: string;
}

/** Input passed to a memory ask runner. */
export interface AskInput {
  job_id: string;
  q: string;
  engram_home: string;
  timezone: string;
  dream_status: string;
}

/** Runner capable of answering a natural-language question from the store. */
export interface MemoryAskRunner {
  ask(input: AskInput): Promise<AskAnswer>;
}
