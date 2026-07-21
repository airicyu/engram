import { runDream, makeDreamRunId } from "../dream/run";
import { isLocked, acquireLock, releaseLock, isLockStale, breakStaleLock, LockError } from "../store/lock";
import { writeDreamJob } from "../store/dream-job";
import { logError, logInfo } from "../log";

export async function handleDreamRun(): Promise<Response> {
  // Stale lock recovery: if server crashed, allow new dream
  if (await isLocked()) {
    if (await isLockStale()) {
      logInfo("dream lock stale — breaking");
      await breakStaleLock();
    } else {
      logInfo("dream rejected — lock held");
      return Response.json(
        { error: "dream_locked", message: "Dream already running. Check /status for progress." },
        { status: 409 },
      );
    }
  }

  // Acquire lock now so we own it before fire-and-forget
  try {
    await acquireLock("dream-run");
  } catch (e) {
    if (e instanceof LockError) {
      logInfo("dream rejected — lock race", { message: e.message });
      return Response.json(
        { error: "dream_locked", message: e.message },
        { status: 409 },
      );
    }
    throw e;
  }

  const dreamRunId = makeDreamRunId();
  const startedAt = new Date().toISOString();

  await writeDreamJob({
    status: "running",
    dream_run_id: dreamRunId,
    started_at: startedAt,
  });
  logInfo("dream job started", { dream_run_id: dreamRunId });

  // Fire and forget — dream runs in background
  runDream({ lockAlreadyHeld: true, dream_run_id: dreamRunId })
    .then(async (result) => {
      await writeDreamJob({
        status: "completed",
        dream_run_id: dreamRunId,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        result: {
          applied: result.applied,
          skipped: result.skipped,
          dead_letter: result.dead_letter,
          extract_status: result.extract_status,
          resumed: result.resumed,
        },
      });
      logInfo("dream job completed", {
        dream_run_id: dreamRunId,
        applied: result.applied.length,
        skipped: result.skipped.length,
        dead_letter: result.dead_letter.length,
        extract_status: result.extract_status,
        resumed: result.resumed,
      });
    })
    .catch(async (e) => {
      const errorMessage = e instanceof Error ? e.message : String(e);
      await writeDreamJob({
        status: "failed",
        dream_run_id: dreamRunId,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        error: errorMessage,
      });
      logError("dream job failed", e, { dream_run_id: dreamRunId });
    })
    .finally(async () => {
      await releaseLock();
      logInfo("dream lock released", { dream_run_id: dreamRunId });
    });

  return Response.json(
    {
      job_id: dreamRunId,
      status: "started",
      message: "Dream job submitted and running in background. Poll GET /status for progress.",
    },
    { status: 202 },
  );
}