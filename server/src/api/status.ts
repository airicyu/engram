/** Status API handler assembling current store and dream pipeline state. */

import { isLocked, isLockStale } from "../store/lock";
import { isL1Empty } from "../store/l1";
import { pendingDlqCount } from "../store/dlq";
import { computeDreamStatus, pendingRunSummary } from "../dream/run";
import { getL1ClearPendingRun } from "../store/dream-runs";
import { readDreamJob } from "../store/dream-job";
import { tailDreamEvents } from "../store/dream-events";
import { getRunningAskJob } from "../store/memory-ask-job";
import { tailAskEvents } from "../store/memory-ask-events";
import { countActiveAnchors } from "../store/future-sight";
import { config } from "../config";

/** Return the status document exposed by GET /status. */
export async function handleStatus(): Promise<object> {
  const dreamJob = await readDreamJob();
  const lock = await isLocked();
  const lockStale = lock ? await isLockStale() : false;
  const dream_status = await computeDreamStatus();
  const dream_pending = await pendingRunSummary();
  const clearPending = await getL1ClearPendingRun();

  let dreamJobPayload: Record<string, unknown> | null = null;
  if (dreamJob) {
    dreamJobPayload = {
      status: dreamJob.status,
      dream_run_id: dreamJob.dream_run_id,
      started_at: dreamJob.started_at,
      completed_at: dreamJob.completed_at ?? null,
      phase: dreamJob.phase ?? null,
      result: dreamJob.result ?? null,
      error: dreamJob.error ?? null,
    };
    if (dreamJob.status === "running") {
      dreamJobPayload.log_tail = await tailDreamEvents(dreamJob.dream_run_id, 20);
    }
  }

  const result: Record<string, unknown> = {
    engram_home: config.engramHome,
    timezone: config.timezone,
    lock,
    l1_empty: await isL1Empty(),
    pending_dlq_count: await pendingDlqCount(),
    future_sight_active_count: await countActiveAnchors(),
    dream_status,
    dream_pending: dream_pending
      ? {
          dream_run_id: dream_pending.dream_run_id,
          scope_count: dream_pending.scope_count,
          patch_count: dream_pending.patch_count,
        }
      : null,
    l1_clear_pending: clearPending
      ? {
          dream_run_id: clearPending.id,
          scope: clearPending.scope,
        }
      : null,
    dream_job: dreamJobPayload,
  };

  if (lock) {
    result.lock_stale = lockStale;
  }

  const askJob = await getRunningAskJob();
  if (askJob) {
    result.ask_job = {
      job_id: askJob.job_id,
      status: askJob.status,
      phase: askJob.phase ?? null,
      started_at: askJob.started_at,
      q: askJob.q,
      log_tail: await tailAskEvents(askJob.job_id, 20),
    };
  } else {
    result.ask_job = null;
  }

  return result;
}
