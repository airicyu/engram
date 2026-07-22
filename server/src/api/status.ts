import { isLocked, isLockStale } from "../store/lock";
import { isL1Empty } from "../store/l1";
import { pendingDlqCount } from "../store/dlq";
import { computeDreamStatus, pendingRunSummary } from "../dream/run";
import { getL1ClearPendingRun } from "../store/dream-runs";
import { readDreamJob } from "../store/dream-job";
import { countActiveAnchors } from "../store/future-sight";
import { config } from "../config";

export async function handleStatus(): Promise<object> {
  const dreamJob = await readDreamJob();
  const lock = await isLocked();
  const lockStale = lock ? await isLockStale() : false;
  const dream_status = await computeDreamStatus();
  const dream_pending = await pendingRunSummary();
  const clearPending = await getL1ClearPendingRun();

  const result: Record<string, unknown> = {
    engram_home: config.engramHome,
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
    dream_job: dreamJob
      ? {
          status: dreamJob.status,
          dream_run_id: dreamJob.dream_run_id,
          started_at: dreamJob.started_at,
          completed_at: dreamJob.completed_at ?? null,
          phase: dreamJob.phase ?? null,
          result: dreamJob.result ?? null,
          error: dreamJob.error ?? null,
        }
      : null,
  };

  if (lock) {
    result.lock_stale = lockStale;
  }

  return result;
}
