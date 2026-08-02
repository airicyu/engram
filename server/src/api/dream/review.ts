/** HTTP handlers for pending review, approve, discard, and cancel. */

import {
  getPendingPayload,
  approveDream,
  discardDream,
  NoPendingError,
  FutureChainIdError,
  StaleFutureAnchorError,
} from "../../dream/run";
import { cancelDream } from "../../dream/review/cancel";
import { isLocked, acquireLock, releaseLock, LockError } from "../../store/dreams/lock";
import { DreamRunMismatchError } from "../../store/dreams/dream-runs";
import { logError, logInfo } from "../../log";

/** GET /dream/pending — return the current review payload. */
export async function handleDreamPending(): Promise<Response> {
  const payload = await getPendingPayload();
  return Response.json(payload);
}

/** POST /dream/approve — commit the pending draft and clear its short-term scope. */
export async function handleDreamApprove(body?: { dream_run_id?: string }): Promise<Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream extract/commit in progress" },
      { status: 409 },
    );
  }

  let lockMeta;
  try {
    lockMeta = await acquireLock("dream-approve");
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
    await releaseLock(lockMeta.token);
  }
}

/** POST /dream/discard — discard the pending draft without clearing short-term. */
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
