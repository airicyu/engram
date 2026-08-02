/** Domain errors returned by the dream lifecycle. */

export { DreamCancelledError } from "../review/cancel-state";

/** Indicates a dream that failed during extract or draft materialization. */
export class DreamIncompleteError extends Error {
  dream_run_id: string;
  phase: "extract" | "materialize";

  constructor(dream_run_id: string, message: string, phase: "extract" | "materialize" = "extract") {
    super(message);
    this.name = "DreamIncompleteError";
    this.dream_run_id = dream_run_id;
    this.phase = phase;
  }
}

/** Indicates a dream request with no short-term events to process. */
export class NothingToDreamError extends Error {
  constructor() {
    super("short-term memory pool is empty — nothing to dream");
    this.name = "NothingToDreamError";
  }
}

/** Indicates POST /dream/run while a pending review already exists. */
export class PendingReviewError extends Error {
  dream_run_id: string;

  constructor(dream_run_id: string) {
    super(`pending dream ${dream_run_id} — approve, discard, or POST /dream/retry with a reason`);
    this.name = "PendingReviewError";
    this.dream_run_id = dream_run_id;
  }
}

/** Indicates an action that requires a pending dream when none exists. */
export class NoPendingError extends Error {
  constructor() {
    super("no pending dream to act on");
    this.name = "NoPendingError";
  }
}

/** Indicates POST /dream/retry without a usable reason. */
export class MissingReasonError extends Error {
  constructor() {
    super("reason is required for dream retry");
    this.name = "MissingReasonError";
  }
}

/** Indicates day-chain patches that incorrectly target future dates. */
export class FutureChainIdError extends Error {
  rejected_chain_ids: string[];

  constructor(ids: string[]) {
    super(`future chain.id blocked: ${ids.join(", ")}`);
    this.name = "FutureChainIdError";
    this.rejected_chain_ids = ids;
  }
}

/** Indicates future-sight patches whose anchors have already expired. */
export class StaleFutureAnchorError extends Error {
  rejected_future_ids: string[];

  constructor(ids: string[]) {
    super(`stale future anchor blocked: ${ids.join(", ")}`);
    this.name = "StaleFutureAnchorError";
    this.rejected_future_ids = ids;
  }
}
