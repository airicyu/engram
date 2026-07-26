/** HTTP handlers for starting, reviewing, approving, discarding, and retrying dreams. */

import {
  runDream,
  retryDream,
  makeDreamRunId,
  NothingToDreamError,
  DreamIncompleteError,
  DreamCancelledError,
  PendingReviewError,
  MissingReasonError,
  getPendingPayload,
  approveDream,
  discardDream,
  NoPendingError,
  FutureChainIdError,
  StaleFutureAnchorError,
} from "../dream/run";
import { cancelDream } from "../dream/cancel";
import { isL1Empty, listPoolEventIds } from "../store/l1";
import { isLocked, acquireLock, releaseLock, isLockStale, breakStaleLock, LockError } from "../store/lock";
import { DreamRunMismatchError, getPendingRun } from "../store/dream-runs";
import { readDreamJob, writeDreamJob } from "../store/dream-job";
import { emitDreamEvent } from "../dream/emit-event";
import { logError, logInfo } from "../log";

const DREAM_SUBMITTED_MESSAGE =
  "Dream extract+materialize submitted. Poll GET /status; when pending_review, GET /dreams/pending then approve, discard, or retry.";

function startDreamJob(
  dreamRunId: string,
  run: () => Promise<{
    scope: string[];
    patch_count: number;
    superseded: string | null;
    retried_from?: string | null;
    extract_status: string;
    phase: string;
  }>,
): Promise<void> {
  const startedAt = new Date().toISOString();

  return writeDreamJob({
    status: "running",
    dream_run_id: dreamRunId,
    started_at: startedAt,
    phase: "extract",
  }).then(() => {
    logInfo("dream job started", { dream_run_id: dreamRunId });

    run()
      .then(async (result) => {
        await writeDreamJob({
          status: "completed",
          dream_run_id: dreamRunId,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          phase: "pending_review",
          result: {
            scope: result.scope,
            patch_count: result.patch_count,
            superseded: result.superseded,
            extract_status: result.extract_status,
            phase: result.phase,
          },
        });
        logInfo("dream job completed → pending_review", {
          dream_run_id: dreamRunId,
          patch_count: result.patch_count,
          superseded: result.superseded,
          retried_from: result.retried_from ?? null,
        });
      })
      .catch(async (e) => {
        const existing = await readDreamJob();
        if (existing?.status === "cancelled" || e instanceof DreamCancelledError) {
          logInfo("dream job cancelled", { dream_run_id: dreamRunId });
          return;
        }
        const errorMessage = e instanceof Error ? e.message : String(e);
        const phase =
          e instanceof DreamIncompleteError
            ? e.phase
            : e instanceof NothingToDreamError
              ? "extract"
              : "extract";
        await writeDreamJob({
          status: "failed",
          dream_run_id: dreamRunId,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          phase,
          error: errorMessage,
        });
        if (!(e instanceof DreamIncompleteError)) {
          emitDreamEvent(dreamRunId, {
            phase: phase === "materialize" ? "materialize" : "extract",
            level: "error",
            event: "run_failed",
            message: errorMessage,
          });
        }
        logError("dream job failed", e, { dream_run_id: dreamRunId, phase });
      })
      .finally(async () => {
        await releaseLock();
        logInfo("dream lock released", { dream_run_id: dreamRunId });
      });
  });
}

/** POST /dream/run — start asynchronous extract and draft materialization. */
export async function handleDreamRun(): Promise<Response> {
  if (await isL1Empty() || (await listPoolEventIds()).length === 0) {
    return Response.json(
      {
        error: "nothing_to_dream",
        message: "L1 pool is empty — capture something before dreaming.",
      },
      { status: 409 },
    );
  }

  const pending = await getPendingRun();
  if (pending) {
    return Response.json(
      {
        error: "pending_review",
        message:
          "A dream is awaiting review. Approve, discard, or POST /dream/retry with a reason.",
        dream_run_id: pending.id,
      },
      { status: 409 },
    );
  }

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
  await startDreamJob(dreamRunId, () =>
    runDream({ lockAlreadyHeld: true, dream_run_id: dreamRunId }),
  );

  return Response.json(
    {
      job_id: dreamRunId,
      status: "started",
      message: DREAM_SUBMITTED_MESSAGE,
    },
    { status: 202 },
  );
}

/** POST /dream/retry — discard pending and re-extract same scope with reason. */
export async function handleDreamRetry(body?: {
  reason?: string;
  dream_run_id?: string;
}): Promise<Response> {
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return Response.json(
      { error: "missing_reason", message: "Body field `reason` is required (non-empty)." },
      { status: 400 },
    );
  }

  const pending = await getPendingRun();
  if (!pending) {
    return Response.json(
      { error: "no_pending", message: "no pending dream to act on" },
      { status: 409 },
    );
  }
  if (body?.dream_run_id && body.dream_run_id !== pending.id) {
    return Response.json(
      {
        error: "dream_run_mismatch",
        message: `dream_run_id mismatch: expected ${pending.id}, got ${body.dream_run_id}`,
        expected: pending.id,
        got: body.dream_run_id,
      },
      { status: 409 },
    );
  }

  if (await isLocked()) {
    if (await isLockStale()) {
      logInfo("dream lock stale — breaking");
      await breakStaleLock();
    } else {
      return Response.json(
        { error: "dream_locked", message: "Dream already running. Check /status for progress." },
        { status: 409 },
      );
    }
  }

  try {
    await acquireLock("dream-retry");
  } catch (e) {
    if (e instanceof LockError) {
      return Response.json({ error: "dream_locked", message: e.message }, { status: 409 });
    }
    throw e;
  }

  const dreamRunId = makeDreamRunId();
  await startDreamJob(dreamRunId, () =>
    retryDream({
      reason,
      dream_run_id: body?.dream_run_id,
      dream_run_id_new: dreamRunId,
      lockAlreadyHeld: true,
    }),
  );

  return Response.json(
    {
      job_id: dreamRunId,
      status: "started",
      message: DREAM_SUBMITTED_MESSAGE,
    },
    { status: 202 },
  );
}

/** GET /dream/pending — return the current review payload. */
export async function handleDreamPending(): Promise<Response> {
  const payload = await getPendingPayload();
  return Response.json(payload);
}

/** POST /dream/approve — commit the pending draft and clear its L1 scope. */
export async function handleDreamApprove(body?: { dream_run_id?: string }): Promise<Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream extract/commit in progress" },
      { status: 409 },
    );
  }

  try {
    await acquireLock("dream-approve");
  } catch (e) {
    if (e instanceof LockError) {
      return Response.json({ error: "dream_locked", message: e.message }, { status: 409 });
    }
    throw e;
  }

  try {
    const result = await approveDream({ dream_run_id: body?.dream_run_id });
    logInfo("dream approved", {
      dream_run_id: result.dream_run_id,
      committed: result.committed.length,
      l1_clear_pending: result.l1_clear_pending,
      empty_patches: result.empty_patches,
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof NoPendingError) {
      return Response.json(
        { error: "no_pending", message: e.message },
        { status: 409 },
      );
    }
    if (e instanceof DreamRunMismatchError) {
      return Response.json(
        {
          error: "dream_run_mismatch",
          message: e.message,
          expected: e.expected,
          got: e.got,
        },
        { status: 409 },
      );
    }
    if (e instanceof FutureChainIdError) {
      return Response.json(
        {
          error: "future_chain_id",
          message: e.message,
          rejected_chain_ids: e.rejected_chain_ids,
        },
        { status: 409 },
      );
    }
    if (e instanceof StaleFutureAnchorError) {
      return Response.json(
        {
          error: "stale_future_anchor",
          message: e.message,
          rejected_future_ids: e.rejected_future_ids,
        },
        { status: 409 },
      );
    }
    logError("dream approve failed", e);
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    await releaseLock();
  }
}

/** POST /dream/discard — discard the pending draft without clearing L1. */
export async function handleDreamDiscard(body?: { dream_run_id?: string }): Promise<Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream extract/commit in progress" },
      { status: 409 },
    );
  }

  try {
    const result = await discardDream({ dream_run_id: body?.dream_run_id });
    logInfo("dream discarded", { dream_run_id: result.dream_run_id });
    return Response.json(result);
  } catch (e) {
    if (e instanceof NoPendingError) {
      return Response.json(
        { error: "no_pending", message: e.message },
        { status: 409 },
      );
    }
    if (e instanceof DreamRunMismatchError) {
      return Response.json(
        {
          error: "dream_run_mismatch",
          message: e.message,
          expected: e.expected,
          got: e.got,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}

/** POST /dream/cancel — cancel a running dream job. */
export async function handleDreamCancel(body?: { dream_run_id?: string }): Promise<Response> {
  try {
    const result = await cancelDream(body);
    if (!result) {
      return Response.json(
        { error: "no_running_dream", message: "No dream job is currently running." },
        { status: 409 },
      );
    }
    logInfo("dream cancel ok", result);
    return Response.json(result);
  } catch (e) {
    if (e instanceof Error && e.name === "DreamRunMismatchError") {
      return Response.json(
        { error: "dream_run_mismatch", message: e.message },
        { status: 409 },
      );
    }
    throw e;
  }
}

// Re-export for tests / callers that might check these.
export { PendingReviewError, MissingReasonError };
