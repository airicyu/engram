/** Per-run abort state for dream cancel. */

const controllers = new Map<string, AbortController>();
const cancelled = new Set<string>();

/** Indicates a dream run was cancelled by the user. */
export class DreamCancelledError extends Error {
  dream_run_id: string;
  constructor(dreamRunId: string) {
    super("dream cancelled");
    this.name = "DreamCancelledError";
    this.dream_run_id = dreamRunId;
  }
}

/** Begin tracking a dream run for cancel. */
export function beginDreamRun(dreamRunId: string): AbortSignal {
  const ac = new AbortController();
  controllers.set(dreamRunId, ac);
  return ac.signal;
}

/** Clear tracking after a dream run finishes. */
export function endDreamRun(dreamRunId: string): void {
  controllers.delete(dreamRunId);
  cancelled.delete(dreamRunId);
}

/** Request cancellation of a running dream. */
export function requestDreamCancel(dreamRunId: string): void {
  cancelled.add(dreamRunId);
  controllers.get(dreamRunId)?.abort();
}

/** Whether a dream run has been cancelled. */
export function isDreamCancelled(dreamRunId: string): boolean {
  return cancelled.has(dreamRunId);
}

/** Throw if the run was cancelled. */
export function throwIfDreamCancelled(dreamRunId: string): void {
  if (isDreamCancelled(dreamRunId)) {
    throw new DreamCancelledError(dreamRunId);
  }
}

/** AbortSignal for a running dream, if any. */
export function dreamAbortSignal(dreamRunId: string): AbortSignal | undefined {
  return controllers.get(dreamRunId)?.signal;
}
