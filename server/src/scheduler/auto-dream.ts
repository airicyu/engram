/** Scheduled auto dream extract (Track B; default off). */

import { runDream, makeDreamRunId } from "../dream/run";
import { isShortTermMemoryEmpty, listPoolEventIds } from "../store/memories/short-term-memory";
import {
  acquireLock,
  breakStaleLock,
  isLockStale,
  isLocked,
  LockError,
} from "../store/dreams/lock";
import { getPendingRun } from "../store/dreams/dream-runs";
import { startDreamJob } from "../api/dream/job";
import { logInfo } from "../log";

/** Run dream extract on schedule when guards pass; no-op with log when skipped. */
export async function tryScheduledAutoDream(): Promise<void> {
  if (await isShortTermMemoryEmpty() || (await listPoolEventIds()).length === 0) {
    logInfo("scheduled auto dream skipped", { reason: "nothing_to_dream" });
    return;
  }

  if (await getPendingRun()) {
    logInfo("scheduled auto dream skipped", { reason: "pending_review" });
    return;
  }

  if (await isLocked()) {
    if (await isLockStale()) {
      logInfo("scheduled auto dream — breaking stale lock");
      await breakStaleLock();
    } else {
      logInfo("scheduled auto dream skipped", { reason: "dream_locked" });
      return;
    }
  }

  let lockMeta;
  try {
    lockMeta = await acquireLock("scheduled-auto-dream");
  } catch (e) {
    if (e instanceof LockError) {
      logInfo("scheduled auto dream skipped", { reason: "dream_locked", detail: e.message });
      return;
    }
    throw e;
  }

  const dreamRunId = makeDreamRunId();
  logInfo("scheduled auto dream starting", { dream_run_id: dreamRunId });
  await startDreamJob(dreamRunId, lockMeta.token, () =>
    runDream({ lockAlreadyHeld: true, dream_run_id: dreamRunId }),
  );
}
