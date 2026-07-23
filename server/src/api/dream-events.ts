/** HTTP handler for dream run event logs. */

import { readDreamEvents } from "../store/dream-events";
import { readDreamJob } from "../store/dream-job";
import { isLocked } from "../store/lock";

/** Response shape for GET /dream/events. */
export interface DreamEventsResponse {
  run_id: string;
  status: "running" | "completed" | "failed" | "unknown";
  phase: string | null;
  events: Awaited<ReturnType<typeof readDreamEvents>>["events"];
  total: number;
  has_more: boolean;
}

async function resolveRunStatus(runId: string): Promise<DreamEventsResponse["status"]> {
  const job = await readDreamJob();
  if (!job || job.dream_run_id !== runId) {
    const { total } = await readDreamEvents(runId, 0);
    return total > 0 ? "unknown" : "unknown";
  }
  if (job.status === "completed") return "completed";
  if (job.status === "failed") return "failed";
  if (job.status === "running" && (await isLocked())) return "running";
  return "unknown";
}

/** Return incremental dream run events for polling. */
export async function handleDreamEvents(
  runId: string | null,
  after: number,
): Promise<DreamEventsResponse | Response> {
  if (!runId?.trim()) {
    return Response.json({ error: "missing run_id" }, { status: 400 });
  }

  const { events, total } = await readDreamEvents(runId, after);
  const status = await resolveRunStatus(runId);
  const job = await readDreamJob();

  return {
    run_id: runId,
    status,
    phase: job?.dream_run_id === runId ? (job.phase ?? null) : null,
    events,
    total,
    has_more: after + events.length < total,
  };
}
