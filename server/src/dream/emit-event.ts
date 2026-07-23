/** Dual-write dream milestones to events.jsonl and server console. */

import { appendDreamEvent, type DreamEvent } from "../store/dream-events";
import { logDream, logError } from "../log";

/** Append a structured dream event and mirror it to console. */
export function emitDreamEvent(
  dreamRunId: string,
  event: Omit<DreamEvent, "ts" | "level"> & { level?: DreamEvent["level"] },
): void {
  const full: DreamEvent = {
    ts: new Date().toISOString(),
    ...event,
    level: event.level ?? "info",
  };
  void appendDreamEvent(dreamRunId, full).catch((e) => {
    logError("dream event append failed", e, {
      dream_run_id: dreamRunId,
      event: event.event,
    });
  });

  const extra = {
    dream_run_id: dreamRunId,
    phase: event.phase,
    ...(event.detail ?? {}),
  };
  if (full.level === "error") {
    logError(`dream | ${event.event}`, undefined, extra);
  } else {
    logDream(event.event, extra);
  }
}
