import {
  runDream,
  makeDreamRunId,
  NothingToDreamError,
  DreamIncompleteError,
  getPendingPayload,
  approveDream,
  discardDream,
  NoPendingError,
  FutureChainIdError,
} from "../dream/run";
import { isL1Empty, listPoolEventIds } from "../store/l1";
import { isLocked, acquireLock, releaseLock, isLockStale, breakStaleLock, LockError } from "../store/lock";
import { DreamRunMismatchError } from "../store/dream-runs";
import { writeDreamJob } from "../store/dream-job";
import { logError, logInfo } from "../log";

export async function handleDreamRun(): Promise<Response> {
  if (await isL1Empty() || (await listPoolEventIds()).length === 0) {
    return Response.json(
      {
        error: "nothing_to_dream",
        message: "L1 pool is empty — ingest something before dreaming.",
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
  const startedAt = new Date().toISOString();

  await writeDreamJob({
    status: "running",
    dream_run_id: dreamRunId,
    started_at: startedAt,
    phase: "extract",
  });
  logInfo("dream job started", { dream_run_id: dreamRunId });

  runDream({ lockAlreadyHeld: true, dream_run_id: dreamRunId })
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
      });
    })
    .catch(async (e) => {
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
      logError("dream job failed", e, { dream_run_id: dreamRunId, phase });
    })
    .finally(async () => {
      await releaseLock();
      logInfo("dream lock released", { dream_run_id: dreamRunId });
    });

  return Response.json(
    {
      job_id: dreamRunId,
      status: "started",
      message:
        "Dream extract+materialize submitted. Poll GET /status; when pending_review, GET /dream/pending then approve or discard.",
    },
    { status: 202 },
  );
}

export async function handleDreamPending(): Promise<Response> {
  const payload = await getPendingPayload();
  return Response.json(payload);
}

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
    logError("dream approve failed", e);
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    await releaseLock();
  }
}

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
