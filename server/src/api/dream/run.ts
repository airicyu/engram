/** HTTP handlers for POST /dreams/run and /dreams/retry. */

import {
  runDream,
  retryDream,
  makeDreamRunId,
  PendingReviewError,
  MissingReasonError,
} from "../../dream/run";
import { isShortTermMemoryEmpty, listPoolEventIds } from "../../store/memories/short-term-memory";
import { isLocked, acquireLock, isLockStale, breakStaleLock, LockError } from "../../store/dreams/lock";
import { getPendingRun } from "../../store/dreams/dream-runs";
import { logInfo } from "../../log";
import { DREAM_SUBMITTED_MESSAGE, startDreamJob } from "./job";

/** POST /dream/run — start asynchronous extract and draft materialization. */
export async function handleDreamRun(): Promise<Response> {
  if (await isShortTermMemoryEmpty() || (await listPoolEventIds()).length === 0) {
    return Response.json(
      {
        error: "nothing_to_dream",
        message: "short-term memory pool is empty — capture something before dreaming.",
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

  let lockMeta;
  try {
    lockMeta = await acquireLock("dream-run");
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
  await startDreamJob(dreamRunId, lockMeta.token, () =>
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

  let lockMeta;
  try {
    lockMeta = await acquireLock("dream-retry");
  } catch (e) {
    if (e instanceof LockError) {
      return Response.json({ error: "dream_locked", message: e.message }, { status: 409 });
    }
    throw e;
  }

  const dreamRunId = makeDreamRunId();
  await startDreamJob(dreamRunId, lockMeta.token, () =>
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

export { PendingReviewError, MissingReasonError };
