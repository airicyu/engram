/** Shared async dream job start + lock release for run／retry. */

import {
  DreamIncompleteError,
  DreamCancelledError,
  AmendFailedError,
  NothingToDreamError,
} from "../../dream/run";
import { readDreamJob, writeDreamJob } from "../../store/dreams/dream-job";
import { releaseLock } from "../../store/dreams/lock";
import { emitDreamEvent } from "../../dream/report/emit-event";
import { logError, logInfo } from "../../log";

export const DREAM_SUBMITTED_MESSAGE =
  "Dream extract+materialize submitted. Poll GET /status; when pending_review, GET /dreams/pending then approve, discard, retry, or amend.";

export const DREAM_AMEND_SUBMITTED_MESSAGE =
  "Dream amend submitted. Poll GET /status; same dream_run_id stays pending_review on success (or remains reviewable if amend fails).";

export function startDreamJob(
  dreamRunId: string,
  lockToken: string,
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
    lock_token: lockToken,
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
          lock_token: lockToken,
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
          e instanceof DreamIncompleteError || e instanceof AmendFailedError
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
          lock_token: lockToken,
          error: errorMessage,
        });
        // DreamIncompleteError／AmendFailedError already emit domain events in pipeline.
        if (!(e instanceof DreamIncompleteError) && !(e instanceof AmendFailedError)) {
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
        const released = await releaseLock(lockToken);
        logInfo("dream lock release attempted", {
          dream_run_id: dreamRunId,
          released,
        });
      });
  });
}
