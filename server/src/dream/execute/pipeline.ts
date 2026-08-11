/** Dream extraction and draft-file execution pipeline. */

import type { AgentRunner, AmendContext, ReviewFeedback } from "../../agent/dream/types";
import { createDreamRunner, createRollupAgent } from "../../agent/factory";
import { acquireLock, isLocked, LockError, releaseLock } from "../../store/dreams/lock";
import {
  isShortTermMemoryEmpty,
  listPoolEventIds,
  readPoolEntriesForScope,
} from "../../store/memories/short-term-memory";
import { draftSummary } from "../../store/dreams/draft";
import {
  discardPending,
  getPendingRun,
  newPendingRun,
  removeDraft,
  writeDreamRun,
  type DreamRunState,
  DreamRunMismatchError,
} from "../../store/dreams/dream-runs";
import { prepareDreamDraft, finalizeDraftFromDisk } from "../../store/dreams/file-pipeline";
import { draftDir, reportPath } from "../../store/dreams/dream-runs";
import { writeFile } from "node:fs/promises";
import { maintainFutureSight } from "../../store/memories/future-sight";
import { writeExtractState } from "../../store/dreams/extract-state";
import { updateDreamJobPhase } from "../../store/dreams/dream-job";
import { logError } from "../../log";
import { logExtractContext } from "../../agent/shared/log";
import { assertInvolvementsValidForPending } from "../score/involvements";
import { beginDreamRun, endDreamRun, isDreamCancelled, throwIfDreamCancelled } from "../review/cancel-state";
import { buildDreamContext, compactChangeLines, formatPreviousSummary, makeDreamRunId } from "./context";
import {
  AmendFailedError,
  DreamCancelledError,
  DreamIncompleteError,
  MissingInstructionError,
  MissingReasonError,
  NoPendingError,
  NothingToDreamError,
  PendingReviewError,
} from "../shared/errors";
import { emitDreamEvent } from "../report/emit-event";
import { finalizeDreamReport } from "../report/finalize";
import { formatRollupReportSection, runRollupCascade } from "../rollup/cascade";
import { hasRollupCatchupWork } from "../rollup/candidates";
import { config } from "../../config";
import { calendarDate, nowIso } from "../../store/memories/activities";
import { listPendingIds, deleteAskingBySourceRunIds, commitClarifyPaths, deleteAskingFile } from "../../store/memories/clarify";
import { runClarifyDistill } from "../clarify/distill";
import { runClarifyGenerate } from "../clarify/generate";

/** Result returned after a dream reaches pending review. */
export interface DreamRunResult {
  dream_run_id: string;
  scope: string[];
  patch_count: number;
  superseded: string | null;
  retried_from: string | null;
  extract_status: "ok";
  phase: "pending_review";
}

/** Run extraction and draft materialization, leaving output pending review. */
export async function runDream(opts?: {
  runner?: AgentRunner;
  dream_run_id?: string;
  lockAlreadyHeld?: boolean;
}): Promise<DreamRunResult> {
  let lockToken: string | null = null;
  if (!opts?.lockAlreadyHeld) {
    if (await isLocked()) throw new LockError("dream already running");
    lockToken = (await acquireLock("dream-run")).token;
  }
  const dreamRunId = opts?.dream_run_id ?? makeDreamRunId();
  beginDreamRun(dreamRunId);
  try {
    const existing = await getPendingRun();
    if (existing) throw new PendingReviewError(existing.id);
    const scope = await listPoolEventIds();
    if ((scope.length === 0 || (await isShortTermMemoryEmpty())) && !(await hasRollupCatchupWork())) {
      throw new NothingToDreamError();
    }
    return await executeDreamPipeline({ dreamRunId, scope, runner: opts?.runner });
  } catch (e) {
    await recordDreamFailure(e, dreamRunId);
    throw e;
  } finally {
    endDreamRun(dreamRunId);
    if (lockToken) await releaseLock(lockToken);
  }
}

/** Discard the active pending dream and rerun its frozen scope with feedback. */
export async function retryDream(opts: {
  reason: string;
  dream_run_id?: string;
  runner?: AgentRunner;
  dream_run_id_new?: string;
  lockAlreadyHeld?: boolean;
}): Promise<DreamRunResult> {
  const reason = opts.reason.trim();
  if (!reason) throw new MissingReasonError();
  let lockToken: string | null = null;
  if (!opts.lockAlreadyHeld) {
    if (await isLocked()) throw new LockError("dream already running");
    lockToken = (await acquireLock("dream-retry")).token;
  }
  const dreamRunId = opts.dream_run_id_new ?? makeDreamRunId();
  beginDreamRun(dreamRunId);
  try {
    const pending = await getPendingRun();
    if (!pending) throw new NoPendingError();
    if (opts.dream_run_id && opts.dream_run_id !== pending.id) {
      throw new DreamRunMismatchError(pending.id, opts.dream_run_id);
    }
    const prevDraft = await draftSummary(pending.id);
    const reviewFeedback: ReviewFeedback = {
      reason,
      previous_summary: formatPreviousSummary(prevDraft),
      previous_changes: compactChangeLines(prevDraft),
      retried_from: pending.id,
    };
    const scope = [...pending.scope];
    // 0.30: before re-generate, delete asking sourced from discarded／superseded run ids.
    const clearIds = new Set<string>([pending.id]);
    if (pending.retried_from) clearIds.add(pending.retried_from);
    const deleted = await deleteAskingBySourceRunIds(clearIds);
    if (deleted.length > 0) {
      await commitClarifyPaths(`engram: clarify retry clear asking`).catch(() => {});
    }
    await discardPending(pending.id);
    return await executeDreamPipeline({ dreamRunId, scope, runner: opts.runner, reviewFeedback });
  } catch (e) {
    await recordDreamFailure(e, dreamRunId);
    throw e;
  } finally {
    endDreamRun(dreamRunId);
    if (lockToken) await releaseLock(lockToken);
  }
}

/**
 * Amend the active pending dream in place (same dream_run_id).
 * Does not discard, wipe draft, or re-run rollup cascade.
 * On failure: pending + draft are preserved (AmendFailedError — no removeDraft).
 */
export async function amendDream(opts: {
  instruction: string;
  dream_run_id?: string;
  runner?: AgentRunner;
  lockAlreadyHeld?: boolean;
}): Promise<DreamRunResult> {
  const instruction = opts.instruction.trim();
  if (!instruction) throw new MissingInstructionError();
  let lockToken: string | null = null;
  if (!opts.lockAlreadyHeld) {
    if (await isLocked()) throw new LockError("dream already running");
    lockToken = (await acquireLock("dream-amend")).token;
  }
  const pending = await getPendingRun();
  if (!pending) throw new NoPendingError();
  if (opts.dream_run_id && opts.dream_run_id !== pending.id) {
    throw new DreamRunMismatchError(pending.id, opts.dream_run_id);
  }
  const dreamRunId = pending.id;
  beginDreamRun(dreamRunId);
  try {
    return await executeAmendPipeline({
      pending,
      instruction,
      runner: opts.runner,
    });
  } catch (e) {
    if (e instanceof DreamCancelledError || isDreamCancelled(dreamRunId)) {
      throw new DreamCancelledError(dreamRunId);
    }
    // Preserve pending／draft — do not call recordDreamFailure／removeDraft.
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: e instanceof AmendFailedError ? e.phase : "extract",
      level: "error",
      event: "amend_failed",
      message: msg,
    });
    logError("dream amend failed (pending kept)", e, { dream_run_id: dreamRunId });
    if (e instanceof AmendFailedError) throw e;
    throw new AmendFailedError(dreamRunId, msg, "extract");
  } finally {
    endDreamRun(dreamRunId);
    if (lockToken) await releaseLock(lockToken);
  }
}

async function executeAmendPipeline(opts: {
  pending: DreamRunState;
  instruction: string;
  runner?: AgentRunner;
}): Promise<DreamRunResult> {
  const { pending, instruction, runner } = opts;
  const dreamRunId = pending.id;
  const scope = [...pending.scope];
  emitDreamEvent(dreamRunId, {
    phase: "extract",
    event: "amend_start",
    message: `Amend started (same run ${dreamRunId})`,
    detail: { instruction_len: instruction.length, scope_count: scope.length },
  });

  const prevDraft = await draftSummary(dreamRunId);
  const draftSummaryText = formatPreviousSummary(prevDraft);
  const agent = runner ?? createDreamRunner();
  const ctx: AmendContext = {
    dream_run_id: dreamRunId,
    instruction,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    now: nowIso(),
    today: calendarDate(),
    scope,
    draft_summary: draftSummaryText,
    store_dir: config.storeDir,
    draft_dir: draftDir(dreamRunId),
    report_path: reportPath(dreamRunId),
  };

  try {
    await agent.amend(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AmendFailedError(dreamRunId, msg, "extract");
  }
  throwIfDreamCancelled(dreamRunId);

  await updateDreamJobPhase("materialize");
  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "amend_materialize_start",
    message: "Finalizing amended draft files",
  });
  try {
    await finalizeDraftFromDisk(dreamRunId);
    await assertInvolvementsValidForPending(dreamRunId);
  } catch (e) {
    if (isDreamCancelled(dreamRunId)) throw new DreamCancelledError(dreamRunId);
    const msg = e instanceof Error ? e.message : String(e);
    throw new AmendFailedError(dreamRunId, msg, "materialize");
  }

  const poolEntries = await readPoolEntriesForScope(scope);
  await finalizeDreamReport({
    dream_run_id: dreamRunId,
    scope,
    events: poolEntries,
    amend_feedback: { instruction },
  });

  const entryCount = (await draftSummary(dreamRunId))?.entry_count ?? 0;
  await writeDreamRun({
    ...pending,
    patch_count: entryCount,
  });
  await writeExtractState({ status: "ok", dream_run_id: dreamRunId });
  emitDreamEvent(dreamRunId, {
    phase: "pending_review",
    event: "amend_complete",
    message: `Amend ready for review (${entryCount} draft entries)`,
    detail: { entries: entryCount },
  });
  return {
    dream_run_id: dreamRunId,
    scope,
    patch_count: entryCount,
    superseded: null,
    retried_from: pending.retried_from ?? null,
    extract_status: "ok",
    phase: "pending_review",
  };
}

async function recordDreamFailure(error: unknown, dreamRunId: string): Promise<void> {
  if (error instanceof DreamCancelledError || isDreamCancelled(dreamRunId)) {
    throw new DreamCancelledError(dreamRunId);
  }
  if (error instanceof DreamIncompleteError) {
    await removeDraft(error.dream_run_id).catch(() => {});
    emitDreamEvent(error.dream_run_id, { phase: error.phase, level: "error", event: "run_failed", message: error.message });
    logError("dream incomplete", error, { dream_run_id: error.dream_run_id, phase: error.phase });
    await writeExtractState({ status: "failed", dream_run_id: error.dream_run_id, message: error.message });
  }
}

export async function executeDreamPipeline(opts: {
  dreamRunId: string;
  scope: string[];
  runner?: AgentRunner;
  reviewFeedback?: ReviewFeedback;
}): Promise<DreamRunResult> {
  const { dreamRunId, scope, runner, reviewFeedback } = opts;
  emitDreamEvent(dreamRunId, {
    phase: "extract", event: "run_start", message: `Dream run started (${scope.length} events in scope)`,
    detail: { scope_count: scope.length, superseded: null, retried_from: reviewFeedback?.retried_from ?? null, has_review_feedback: !!reviewFeedback },
  });
  try {
    const maint = await maintainFutureSight({ mode: "full", target: "live", commit: true });
    if (maint.changed) {
      emitDreamEvent(dreamRunId, {
        phase: "extract", event: "future_sight_maintain",
        message: `Future-sight maintain: expired=${maint.expired.length} out_of_window=${maint.out_of_window.length}`,
        detail: { expired: maint.expired, out_of_window: maint.out_of_window, committed: maint.committed },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, { phase: "extract", level: "error", event: "future_sight_maintain_failed", message: msg });
    throw new DreamIncompleteError(dreamRunId, `future-sight maintain failed: ${msg}`, "extract");
  }

  await prepareDreamDraft(dreamRunId);
  if (scope.length === 0) {
    // Rollup-only: no day extract. Cover the "short-term is empty" case; keep
    // the report skeleton so the narrative is not just "no files".
    await writeRollupOnlyReportSkeleton(dreamRunId);
    emitDreamEvent(dreamRunId, {
      phase: "extract",
      event: "extract_skipped",
      message: "Short-term empty — rollup-only run, skipping day extract",
      detail: { rollup_only: true },
    });
  } else {
    await doDreamFiles(dreamRunId, scope, runner, reviewFeedback);
    throwIfDreamCancelled(dreamRunId);
  }
  await updateDreamJobPhase("materialize");
  emitDreamEvent(dreamRunId, { phase: "materialize", event: "materialize_start", message: "Finalizing draft files" });
  if (scope.length > 0) {
    try {
      await finalizeDraftFromDisk(dreamRunId);
    } catch (e) {
      await removeDraft(dreamRunId).catch(() => {});
      if (isDreamCancelled(dreamRunId)) throw new DreamCancelledError(dreamRunId);
      const msg = e instanceof Error ? e.message : String(e);
      emitDreamEvent(dreamRunId, { phase: "materialize", level: "error", event: "materialize_failed", message: msg });
      throw new DreamIncompleteError(dreamRunId, msg, "materialize");
    }
  }
  emitDreamEvent(dreamRunId, { phase: "materialize", event: "materialize_done", message: "Draft files finalized" });

  let rollupSection = "";
  try {
    throwIfDreamCancelled(dreamRunId);
    const draft = await draftSummary(dreamRunId);
    const dayIds = draft?.chain_summary_days?.length ? draft.chain_summary_days : (draft?.chain_days ?? []);
    const { reports } = await runRollupCascade({ dreamRunId, dayIds, agent: createRollupAgent() });
    rollupSection = formatRollupReportSection(reports);
    await finalizeDraftFromDisk(dreamRunId);
  } catch (e) {
    await removeDraft(dreamRunId).catch(() => {});
    if (isDreamCancelled(dreamRunId)) throw new DreamCancelledError(dreamRunId);
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, { phase: "materialize", level: "error", event: "rollup_failed", message: msg });
    throw new DreamIncompleteError(dreamRunId, msg, "materialize");
  }

  const poolEntries = await readPoolEntriesForScope(scope);
  try {
    await assertInvolvementsValidForPending(dreamRunId);
  } catch (e) {
    await removeDraft(dreamRunId).catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, { phase: "materialize", level: "error", event: "involvements_invalid", message: msg });
    throw new DreamIncompleteError(dreamRunId, msg, "materialize");
  }

  // 0.30: clarify_distill → finalizeDraft → clarify_generate → report → pending_review
  let clarifySnapshotIds: string[] = [];
  let clarifyDistilledNodeIds: string[] = [];
  let clarifyDistillNarrative = "_None_";
  let clarifyGeneratedIds: string[] = [];
  try {
    throwIfDreamCancelled(dreamRunId);
    clarifySnapshotIds = await listPendingIds();
    const distill = await runClarifyDistill({
      dreamRunId,
      snapshotIds: clarifySnapshotIds,
    });
    clarifyDistilledNodeIds = distill.distilled_node_ids;
    clarifyDistillNarrative = distill.narrative;
    await finalizeDraftFromDisk(dreamRunId);
    const gen = await runClarifyGenerate({ dreamRunId });
    clarifyGeneratedIds = gen.written_ids;
    await finalizeDreamReport({
      dream_run_id: dreamRunId,
      scope,
      events: poolEntries,
      review_feedback: reviewFeedback,
      rollup_section: rollupSection,
      clarify_distill_section: clarifyDistillNarrative,
    });
  } catch (e) {
    // INDEX #34: best-effort delete asking written this job if dream fails after land
    if (clarifyGeneratedIds.length > 0) {
      for (const id of clarifyGeneratedIds) {
        await deleteAskingFile(id).catch(() => {});
      }
      await commitClarifyPaths(`engram: clarify generate rollback ${dreamRunId}`).catch(() => {});
    }
    await removeDraft(dreamRunId).catch(() => {});
    if (isDreamCancelled(dreamRunId)) throw new DreamCancelledError(dreamRunId);
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      level: "error",
      event: "clarify_failed",
      message: msg,
    });
    throw new DreamIncompleteError(dreamRunId, msg, "materialize");
  }

  const entryCount = (await draftSummary(dreamRunId))?.entry_count ?? 0;
  await writeDreamRun(newPendingRun({
    id: dreamRunId, scope, patch_count: entryCount,
    retried_from: reviewFeedback?.retried_from, retry_reason: reviewFeedback?.reason,
    clarify_pending_snapshot_ids: clarifySnapshotIds,
    clarify_distilled_node_ids: clarifyDistilledNodeIds,
  }));
  await writeExtractState({ status: "ok", dream_run_id: dreamRunId });
  emitDreamEvent(dreamRunId, {
    phase: "pending_review", event: "run_complete", message: `Ready for review (${entryCount} draft entries)`,
    detail: { entries: entryCount, retried_from: reviewFeedback?.retried_from ?? null },
  });
  return {
    dream_run_id: dreamRunId, scope, patch_count: entryCount, superseded: null,
    retried_from: reviewFeedback?.retried_from ?? null, extract_status: "ok", phase: "pending_review",
  };
}

/** Write a minimal report skeleton marking the run as rollup-only (no new events). */
async function writeRollupOnlyReportSkeleton(dreamRunId: string): Promise<void> {
  const md = [
    `# Dream report — ${dreamRunId}`,
    "",
    "## Narrative",
    "",
    "### Timeline",
    "",
    "_Rollup-only dream — short-term pool was empty; no new events extracted._",
    "",
    "### Long-term updates",
    "",
    "_None._",
    "",
    "### Near future",
    "",
    "_None._",
    "",
    "### Uncertainties",
    "",
    "_None._",
    "",
  ].join("\n");
  await writeFile(reportPath(dreamRunId), md, "utf8");
}

async function doDreamFiles(
  dreamRunId: string,
  scope: string[],
  runner?: AgentRunner,
  reviewFeedback?: ReviewFeedback,
): Promise<void> {
  const agent = runner ?? createDreamRunner();
  const ctx = await buildDreamContext(dreamRunId, scope, reviewFeedback);
  logExtractContext({
    dream_run_id: dreamRunId, events: ctx.events.length, l1_chars: ctx.l1.summary.length,
    node_notes: Object.keys(ctx.l1.node_notes).length, existing_nodes: ctx.existing_nodes.length, l2_nodes: ctx.l2_current.length,
  });
  try {
    await agent.dream(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, { phase: "extract", level: "error", event: "extract_failed", message: msg, detail: { reason: "agent" } });
    throw new DreamIncompleteError(dreamRunId, msg, "extract");
  }
}

export type { DreamRunState };
