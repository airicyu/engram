/** Emit structured memory ask job events. */

import { nowIso } from "../store/memories/activities";
import { appendAskEvent, type AskEvent, type AskEventPhase } from "../store/tmp/ask-events";

/** Append one ask job event with a generated timestamp. */
export function emitAskEvent(
  jobId: string,
  partial: Omit<AskEvent, "ts"> & { ts?: string },
): void {
  void appendAskEvent(jobId, {
    ts: partial.ts ?? nowIso(),
    level: partial.level,
    phase: partial.phase,
    event: partial.event,
    message: partial.message,
    detail: partial.detail,
  });
}

export type { AskEventPhase };
