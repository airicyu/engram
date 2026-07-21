import { isLocked, isLockStale } from "../store/lock";
import { isL1Empty } from "../store/l1";
import { pendingDlqCount } from "../store/dlq";
import { computeDreamStatus } from "../dream/run";
import { readDreamJob } from "../store/dream-job";
import type { DreamJobState } from "../store/dream-job";
import { config } from "../config";

export async function handleStatus(): Promise<object> {
  const dreamJob = await readDreamJob();
  const lock = await isLocked();
  const lockStale = lock ? await isLockStale() : false;

  const result: Record<string, unknown> = {
    engram_home: config.engramHome,
    lock,
    l1_empty: await isL1Empty(),
    pending_dlq_count: await pendingDlqCount(),
    dream_status: await computeDreamStatus(),
    dream_job: dreamJob
      ? {
          status: dreamJob.status,
          dream_run_id: dreamJob.dream_run_id,
          started_at: dreamJob.started_at,
          completed_at: dreamJob.completed_at ?? null,
          result: dreamJob.result ?? null,
          error: dreamJob.error ?? null,
        }
      : null,
  };

  // Only include lock_stale when lock is true (omit otherwise)
  if (lock) {
    result.lock_stale = lockStale;
  }

  return result;
}