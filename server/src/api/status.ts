/** Status API handler assembling current store and dream pipeline state. */

import { isLocked, isLockStale } from "../store/dreams/lock";
import { isShortTermMemoryEmpty } from "../store/memories/short-term-memory";
import { computeDreamStatus, pendingRunSummary } from "../dream/run";
import { getShortTermClearPendingRun } from "../store/dreams/dream-runs";
import { readDreamJob } from "../store/dreams/dream-job";
import { tailDreamEvents } from "../store/dreams/dream-events";
import { getRunningAskJob } from "../store/tmp/ask-job";
import { tailAskEvents } from "../store/tmp/ask-events";
import { countZoneAnchors } from "../store/memories/future-sight";
import { config, peekStoreVersion } from "../config";
import { getClockSnapshot } from "../store/clock";
import { isStoreGitReady } from "../store/git";
import { getLastDreamCleanupResult } from "../store/dreams/cleanup";

/** Return the status document exposed by GET /status. */
export async function handleStatus(): Promise<object> {
  const dreamJob = await readDreamJob();
  const lock = await isLocked();
  const lockStale = lock ? await isLockStale() : false;
  const dream_status = await computeDreamStatus();
  const dream_pending = await pendingRunSummary();
  const clearPending = await getShortTermClearPendingRun();
  const fsCounts = await countZoneAnchors();

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
    store_dir: config.storeDir,
    store_git: await isStoreGitReady(),
    store_version: peekStoreVersion(),
    product_version: config.productVersion,
    temp_dir: config.tempDir,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    future_sight_window_days: config.futureSightWindowDays,
    future_sight_hot_days: config.futureSightHotDays,
    clock: getClockSnapshot(),
    lock,
    l1_empty: await isShortTermMemoryEmpty(),
    future_sight_active_count: fsCounts.total,
    future_sight_hot_count: fsCounts.hot,
    future_sight_later_count: fsCounts.later,
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
    dream_scheduler: {
      cleanup_cron: config.dreamCleanupCron,
      cleanup_cron_enabled: config.dreamCleanupCronEnabled,
      cleanup_on_start: config.dreamCleanupOnStart,
      staging_retention_days: config.dreamStagingRetentionDays,
      committed_report_retention_days: config.dreamCommittedReportRetentionDays,
      cleanup_min_age_days: config.dreamCleanupMinAgeDays,
      auto_dream_enabled: config.autoDreamEnabled,
      auto_dream_cron: config.autoDreamCron,
    },
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

  const dreamCleanup = getLastDreamCleanupResult();
  if (dreamCleanup) {
    result.dream_cleanup = dreamCleanup;
  }

  return result;
}
