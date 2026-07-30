/** Dream orchestration: extract, materialize, review, approve, and discard. */

import type { AgentRunner, DreamContext, ReviewFeedback } from "../agent/types";
import { ClaudeCodeRunner } from "../agent/claude-code";
import { CursorCliRunner } from "../agent/cursor-cli";
import { MockFailRunner, MockOkRunner } from "../agent/mock";
import { acquireLock, releaseLock, isLocked, LockError } from "../store/dreams/lock";
import {
  readPoolEntriesForScope,
  listPoolEventIds,
  isShortTermMemoryEmpty,
  clearShortTermMemoryScope,
} from "../store/memories/short-term-memory";
import { calendarDate, nowIso } from "../store/memories/activities";
import { makeRunId } from "../store/run-id";
import { listNodeIds, readAllWhatCurrents } from "../store/memories/nodes";
import { readDay, readDaySummary } from "../store/memories/chain";
import { readExtractState, writeExtractState } from "../store/dreams/extract-state";
import { logError, logDreamDebug } from "../log";
import { emitDreamEvent } from "./emit-event";
import { logExtractContext } from "../agent/extract-log";
import { updateDreamJobPhase } from "../store/dreams/dream-job";
import { finalizeDreamReport } from "./report-finalize";
import {
  beginDreamRun,
  endDreamRun,
  throwIfDreamCancelled,
  DreamCancelledError,
  isDreamCancelled,
} from "./cancel-state";
import {
  draftSummary,
  commitDraft,
  readManifest,
} from "../store/dreams/draft";
import { prepareDreamDraft, finalizeDraftFromDisk, readDraftDeletes } from "../store/dreams/file-pipeline";
import {
  commitDirtyMemorySnapshot,
  stageAndCommitPaths,
} from "../store/git";
import { maintainFutureSight, listAnchors } from "../store/memories/future-sight";
import { config } from "../config";
import {
  DreamRunMismatchError,
  discardPending,
  getShortTermClearPendingRun,
  getPendingRun,
  newPendingRun,
  readReport,
  removeDraft,
  writeDreamRun,
  draftDir,
  reportPath,
  type DreamRunState,
} from "../store/dreams/dream-runs";
import { formatRollupReportSection, runRollupCascade } from "./rollup";
import { pickRollupAgent } from "../agent/rollup";
import { addInitializedIds, type HigherChainLevel } from "../store/memories/chain-higher";

export { DreamCancelledError } from "./cancel-state";

/** Indicates a dream that failed during extract or draft materialization. */
export class DreamIncompleteError extends Error {
  dream_run_id: string;
  phase: "extract" | "materialize";
  constructor(dream_run_id: string, message: string, phase: "extract" | "materialize" = "extract") {
    super(message);
    this.name = "DreamIncompleteError";
    this.dream_run_id = dream_run_id;
    this.phase = phase;
  }
}

/** Indicates a dream request with no short-term events to process. */
export class NothingToDreamError extends Error {
  constructor() {
    super("short-term memory pool is empty — nothing to dream");
    this.name = "NothingToDreamError";
  }
}

/** Indicates POST /dream/run while a pending review already exists. */
export class PendingReviewError extends Error {
  dream_run_id: string;
  constructor(dream_run_id: string) {
    super(
      `pending dream ${dream_run_id} — approve, discard, or POST /dream/retry with a reason`,
    );
    this.name = "PendingReviewError";
    this.dream_run_id = dream_run_id;
  }
}

/** Compact one-line descriptions of draft changes for retry context. */
export function compactChangeLines(draft: Awaited<ReturnType<typeof draftSummary>>): string[] {
  if (!draft) return [];
  const lines: string[] = [];
  for (const d of draft.chain_summary_days) lines.push(`day summary ${d}`);
  for (const d of draft.chain_days) lines.push(`day ledger ${d}`);
  for (const id of draft.chain_weeks) lines.push(`week summary ${id}`);
  for (const id of draft.chain_months) lines.push(`month summary ${id}`);
  for (const id of draft.chain_years) lines.push(`year summary ${id}`);
  for (const id of draft.future_ids) lines.push(`future ${id}`);
  return lines;
}

/** Build a short previous-attempt summary for retry feedback. */
export function formatPreviousSummary(draft: Awaited<ReturnType<typeof draftSummary>>): string {
  const parts: string[] = [];
  if (draft) {
    parts.push(`draft entries: ${draft.entry_count}`);
    if (draft.chain_summary_days.length) {
      parts.push(`day summaries: ${draft.chain_summary_days.join(", ")}`);
    }
    if (draft.chain_days.length) {
      parts.push(`day ledgers: ${draft.chain_days.join(", ")}`);
    }
    if (draft.chain_weeks.length) parts.push(`weeks: ${draft.chain_weeks.join(", ")}`);
    if (draft.chain_months.length) parts.push(`months: ${draft.chain_months.join(", ")}`);
    if (draft.chain_years.length) parts.push(`years: ${draft.chain_years.join(", ")}`);
    if (draft.future_ids.length) parts.push(`futures: ${draft.future_ids.join(", ")}`);
  } else {
    parts.push("draft: (none)");
  }
  return parts.join("; ");
}

/** Create a collision-resistant identifier for a dream run. */
export function makeDreamRunId(at = nowIso()): string {
  return makeRunId("dream", at);
}

function pickRunner(): AgentRunner {
  const mode = process.env.ENGRAM_AGENT ?? "claude";
  if (mode === "mock-fail") return new MockFailRunner();
  if (mode === "mock-ok") return new MockOkRunner();
  if (mode === "cursor") return new CursorCliRunner();
  return new ClaudeCodeRunner();
}

/** Build the frozen short-term, L2, and chain context supplied to a dream runner. */
export async function buildDreamContext(
  dreamRunId: string,
  scope: string[],
  reviewFeedback?: ReviewFeedback,
): Promise<DreamContext> {
  const scopeEntries = await readPoolEntriesForScope(scope);
  // short-term pool already holds id/ts/raw/node_refs for S — avoid readAllEvents() on huge L0 log.
  const events = scopeEntries.map((e) => ({
    id: e.id,
    ts: e.ts,
    raw: e.raw,
    node_refs: e.node_refs,
  }));

  const summary = scopeEntries
    .map((e) => `- [${e.ts}] (${e.id}) ${e.raw.trim()}`)
    .join("\n");
  const node_notes: Record<string, string> = {};
  for (const e of scopeEntries) {
    for (const nodeId of e.node_refs ?? []) {
      const line = `- [${e.ts}] (${e.id}) ${e.raw.trim()}`;
      node_notes[nodeId] = node_notes[nodeId] ? `${node_notes[nodeId].trimEnd()}\n${line}` : line;
    }
  }
  for (const k of Object.keys(node_notes)) {
    node_notes[k] = node_notes[k].endsWith("\n") ? node_notes[k] : node_notes[k] + "\n";
  }

  const existing_nodes = await listNodeIds();
  const l2_current = await readAllWhatCurrents();

  const today = calendarDate();
  const candidateDays = new Set<string>([today]);
  for (const e of events) {
    candidateDays.add(calendarDate(e.ts));
  }
  const days = [...candidateDays].sort();

  const chain_summaries_current: DreamContext["chain_summaries_current"] = [];
  const chain_ledgers: NonNullable<DreamContext["chain_ledgers"]> = [];
  for (const day of days) {
    chain_summaries_current.push({ day, current: await readDaySummary(day) });
    chain_ledgers.push({ day, content: await readDay(day) });
  }

  return {
    dream_run_id: dreamRunId,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    now: nowIso(),
    today,
    scope,
    l1: { summary: summary ? summary + "\n" : "", node_notes },
    events,
    l2_current,
    existing_nodes,
    chain_summaries_current,
    chain_ledgers,
    store_dir: config.storeDir,
    draft_dir: draftDir(dreamRunId),
    report_path: reportPath(dreamRunId),
    ...(reviewFeedback ? { review_feedback: reviewFeedback } : {}),
  };
}

/** @deprecated Use buildDreamContext. */
export const buildExtractContext = buildDreamContext;

/** Result returned after a dream reaches pending review. */
export interface DreamRunResult {
  dream_run_id: string;
  scope: string[];
  patch_count: number;
  /** Always null since 0.12 — supersede via /dream/run removed. */
  superseded: string | null;
  retried_from: string | null;
  extract_status: "ok";
  phase: "pending_review";
}

/** Run extraction and draft materialization, leaving output pending review. */
export async function runDream(opts?: {
  runner?: AgentRunner;
  dream_run_id?: string;
  /** Set true when caller has already acquired the dream lock. */
  lockAlreadyHeld?: boolean;
}): Promise<DreamRunResult> {
  if (!opts?.lockAlreadyHeld) {
    if (await isLocked()) {
      throw new LockError("dream already running");
    }
    await acquireLock("dream-run");
  }

  const dreamRunId = opts?.dream_run_id ?? makeDreamRunId();

  beginDreamRun(dreamRunId);

  try {
    const existing = await getPendingRun();
    if (existing) {
      throw new PendingReviewError(existing.id);
    }

    const scope = await listPoolEventIds();
    if (scope.length === 0 || (await isShortTermMemoryEmpty())) {
      throw new NothingToDreamError();
    }

    return await executeDreamPipeline({
      dreamRunId,
      scope,
      runner: opts?.runner,
    });
  } catch (e) {
    if (e instanceof DreamCancelledError || isDreamCancelled(dreamRunId)) {
      throw new DreamCancelledError(dreamRunId);
    }
    if (e instanceof DreamIncompleteError) {
      emitDreamEvent(e.dream_run_id, {
        phase: e.phase,
        level: "error",
        event: "run_failed",
        message: e.message,
      });
      logError("dream incomplete", e, { dream_run_id: e.dream_run_id, phase: e.phase });
      await writeExtractState({
        status: "failed",
        dream_run_id: e.dream_run_id,
        message: e.message,
      });
    }
    throw e;
  } finally {
    endDreamRun(dreamRunId);
    if (!opts?.lockAlreadyHeld) {
      await releaseLock();
    }
  }
}

/**
 * Discard the active pending dream and re-extract the same frozen scope
 * with human reason + previous draft／patch summary.
 */
export async function retryDream(opts: {
  reason: string;
  dream_run_id?: string;
  runner?: AgentRunner;
  dream_run_id_new?: string;
  /** Set true when caller has already acquired the dream lock. */
  lockAlreadyHeld?: boolean;
}): Promise<DreamRunResult> {
  const reason = opts.reason.trim();
  if (!reason) {
    throw new MissingReasonError();
  }

  if (!opts.lockAlreadyHeld) {
    if (await isLocked()) {
      throw new LockError("dream already running");
    }
    await acquireLock("dream-retry");
  }

  const dreamRunId = opts.dream_run_id_new ?? makeDreamRunId();
  beginDreamRun(dreamRunId);

  try {
    const pending = await getPendingRun();
    if (!pending) {
      throw new NoPendingError();
    }
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

    await discardPending(pending.id);

    return await executeDreamPipeline({
      dreamRunId,
      scope,
      runner: opts.runner,
      reviewFeedback,
    });
  } catch (e) {
    if (e instanceof DreamCancelledError || isDreamCancelled(dreamRunId)) {
      throw new DreamCancelledError(dreamRunId);
    }
    if (e instanceof DreamIncompleteError) {
      emitDreamEvent(e.dream_run_id, {
        phase: e.phase,
        level: "error",
        event: "run_failed",
        message: e.message,
      });
      logError("dream incomplete", e, { dream_run_id: e.dream_run_id, phase: e.phase });
      await writeExtractState({
        status: "failed",
        dream_run_id: e.dream_run_id,
        message: e.message,
      });
    }
    throw e;
  } finally {
    endDreamRun(dreamRunId);
    if (!opts.lockAlreadyHeld) {
      await releaseLock();
    }
  }
}

async function executeDreamPipeline(opts: {
  dreamRunId: string;
  scope: string[];
  runner?: AgentRunner;
  reviewFeedback?: ReviewFeedback;
}): Promise<DreamRunResult> {
  const { dreamRunId, scope, runner, reviewFeedback } = opts;

  emitDreamEvent(dreamRunId, {
    phase: "extract",
    event: "run_start",
    message: `Dream run started (${scope.length} events in scope)`,
    detail: {
      scope_count: scope.length,
      superseded: null,
      retried_from: reviewFeedback?.retried_from ?? null,
      has_review_feedback: !!reviewFeedback,
    },
  });

  // 0.17: calendar maintain before agent (may git-commit; no AI).
  try {
    const maint = await maintainFutureSight({
      mode: "full",
      target: "live",
      commit: true,
    });
    if (maint.changed) {
      emitDreamEvent(dreamRunId, {
        phase: "extract",
        event: "future_sight_maintain",
        message: `Future-sight maintain: expired=${maint.expired.length} out_of_window=${maint.out_of_window.length}`,
        detail: {
          expired: maint.expired,
          out_of_window: maint.out_of_window,
          committed: maint.committed,
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: "extract",
      level: "error",
      event: "future_sight_maintain_failed",
      message: msg,
    });
    throw new DreamIncompleteError(dreamRunId, `future-sight maintain failed: ${msg}`, "extract");
  }

  await prepareDreamDraft(dreamRunId);
  await doDreamFiles(dreamRunId, scope, runner, reviewFeedback);

  throwIfDreamCancelled(dreamRunId);

  await updateDreamJobPhase("materialize");
  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "materialize_start",
    message: "Finalizing draft files",
  });

  try {
    await finalizeDraftFromDisk(dreamRunId);
  } catch (e) {
    await removeDraft(dreamRunId).catch(() => {});
    if (isDreamCancelled(dreamRunId)) {
      throw new DreamCancelledError(dreamRunId);
    }
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      level: "error",
      event: "materialize_failed",
      message: msg,
    });
    throw new DreamIncompleteError(dreamRunId, msg, "materialize");
  }

  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "materialize_done",
    message: "Draft files finalized",
  });

  let rollupSection = "";
  try {
    throwIfDreamCancelled(dreamRunId);
    const draft = await draftSummary(dreamRunId);
    const dayIds = draft?.chain_summary_days?.length
      ? draft.chain_summary_days
      : (draft?.chain_days ?? []);
    const { reports } = await runRollupCascade({
      dreamRunId,
      dayIds,
      agent: pickRollupAgent(),
    });
    rollupSection = formatRollupReportSection(reports);
    await finalizeDraftFromDisk(dreamRunId);
  } catch (e) {
    await removeDraft(dreamRunId).catch(() => {});
    if (isDreamCancelled(dreamRunId)) {
      throw new DreamCancelledError(dreamRunId);
    }
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      level: "error",
      event: "rollup_failed",
      message: msg,
    });
    throw new DreamIncompleteError(dreamRunId, msg, "materialize");
  }

  const poolEntries = await readPoolEntriesForScope(scope);
  await finalizeDreamReport({
    dream_run_id: dreamRunId,
    scope,
    events: poolEntries,
    review_feedback: reviewFeedback,
    rollup_section: rollupSection,
  });
  const entryCount = (await draftSummary(dreamRunId))?.entry_count ?? 0;

  const run = newPendingRun({
    id: dreamRunId,
    scope,
    patch_count: entryCount,
    retried_from: reviewFeedback?.retried_from,
    retry_reason: reviewFeedback?.reason,
  });
  await writeDreamRun(run);
  await writeExtractState({ status: "ok", dream_run_id: dreamRunId });

  emitDreamEvent(dreamRunId, {
    phase: "pending_review",
    event: "run_complete",
    message: `Ready for review (${entryCount} draft entries)`,
    detail: {
      entries: entryCount,
      retried_from: reviewFeedback?.retried_from ?? null,
    },
  });

  return {
    dream_run_id: dreamRunId,
    scope,
    patch_count: entryCount,
    superseded: null,
    retried_from: reviewFeedback?.retried_from ?? null,
    extract_status: "ok",
    phase: "pending_review",
  };
}

async function doDreamFiles(
  dreamRunId: string,
  scope: string[],
  runner?: AgentRunner,
  reviewFeedback?: ReviewFeedback,
): Promise<void> {
  const agent = runner ?? pickRunner();
  const ctx = await buildDreamContext(dreamRunId, scope, reviewFeedback);

  logExtractContext({
    dream_run_id: dreamRunId,
    events: ctx.events.length,
    l1_chars: ctx.l1.summary.length,
    node_notes: Object.keys(ctx.l1.node_notes).length,
    existing_nodes: ctx.existing_nodes.length,
    l2_nodes: ctx.l2_current.length,
  });

  try {
    await agent.dream(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitDreamEvent(dreamRunId, {
      phase: "extract",
      level: "error",
      event: "extract_failed",
      message: msg,
      detail: { reason: "agent" },
    });
    throw new DreamIncompleteError(
      dreamRunId,
      e instanceof Error ? e.message : String(e),
      "extract",
    );
  }
}

/** High-level state reported for the dream pipeline. */
export type DreamStatus =
  | "ok"
  | "pending_review"
  | "dream_incomplete"
  | "never_dreamed"
  | "l1_clear_pending";

/** Derive the current dream pipeline state from persistent records. */
export async function computeDreamStatus(): Promise<DreamStatus> {
  const pending = await getPendingRun();
  if (pending) return "pending_review";

  const clearPending = await getShortTermClearPendingRun();
  if (clearPending) return "l1_clear_pending";

  const extractState = await readExtractState();
  const l1Empty = await isShortTermMemoryEmpty();

  if (extractState.status === "failed" && !l1Empty) {
    return "dream_incomplete";
  }

  if (extractState.status === "never") {
    return "never_dreamed";
  }

  return "ok";
}

/** Return the complete payload for the active pending dream, if any. */
export async function getPendingPayload(): Promise<{
  present: boolean;
  dream_run_id: string | null;
  scope: string[];
  report: string | null;
  draft_summary: {
    entry_count: number;
    chain_days: string[];
    chain_summary_days: string[];
    chain_weeks: string[];
    chain_months: string[];
    chain_years: string[];
    future_ids: string[];
  } | null;
}> {
  const pending = await getPendingRun();
  if (!pending) {
    return {
      present: false,
      dream_run_id: null,
      scope: [],
      report: null,
      draft_summary: null,
    };
  }

  const report = await readReport(pending.id);
  const draft_summary = await draftSummary(pending.id);

  return {
    present: true,
    dream_run_id: pending.id,
    scope: pending.scope,
    report,
    draft_summary,
  };
}

/** Result returned after committing a pending dream. */
export interface ApproveResult {
  dream_run_id: string;
  committed: string[];
  cleared_scope: string[];
  l1_clear_pending: boolean;
  empty_patches: boolean;
}

/** Commit the pending draft and clear its frozen short-term scope. */
export async function approveDream(opts?: { dream_run_id?: string }): Promise<ApproveResult> {
  // Retry path: commit already done, only clear short-term memory
  const clearOnly = await getShortTermClearPendingRun();
  if (clearOnly) {
    if (opts?.dream_run_id && opts.dream_run_id !== clearOnly.id) {
      throw new DreamRunMismatchError(clearOnly.id, opts.dream_run_id);
    }
    await clearShortTermMemoryScope(clearOnly.scope);
    clearOnly.l1_clear_pending = false;
    await writeDreamRun(clearOnly);
    await stageAndCommitPaths(
      ["memories/short-term-memory"],
      `engram: dream ${clearOnly.id} (scope clear)`,
    ).catch((e) => logError("git commit after scope clear failed", e, { dream_run_id: clearOnly.id }));
    return {
      dream_run_id: clearOnly.id,
      committed: [],
      cleared_scope: clearOnly.scope,
      l1_clear_pending: false,
      empty_patches: clearOnly.patch_count === 0,
    };
  }

  const pending = await getPendingRun();
  if (!pending) {
    throw new NoPendingError();
  }
  if (opts?.dream_run_id && opts.dream_run_id !== pending.id) {
    throw new DreamRunMismatchError(pending.id, opts.dream_run_id);
  }

  const draft = await draftSummary(pending.id);
  const rejected = [...new Set([
    ...(draft?.chain_days ?? []),
    ...(draft?.chain_summary_days ?? []),
  ])]
    .filter((id) => id > calendarDate())
    .sort();
  if (rejected.length > 0) {
    throw new FutureChainIdError(rejected);
  }

  // 0.17: full maintain on draft before deploy (correct zones／sort; expired → 409).
  const draftRoot = draftDir(pending.id);
  const draftMaint = await maintainFutureSight({
    mode: "full",
    target: "draft",
    baseDir: draftRoot,
    commit: false,
  });
  if (draftMaint.stale_expired.length > 0) {
    throw new StaleFutureAnchorError(draftMaint.stale_expired);
  }
  if (draftMaint.changed) {
    // Rebucket may create／rewrite zone files not yet in manifest.
    await finalizeDraftFromDisk(pending.id);
  }
  // Re-scan after maintain (defence).
  const stale = await staleDraftFutureAnchorIds(pending.id);
  if (stale.length > 0) {
    throw new StaleFutureAnchorError(stale);
  }

  // Preserve unrelated L0／short-term dirty state before deploy (path rollback must not erase them).
  await commitDirtyMemorySnapshot(`engram: autosave before ${pending.id}`).catch((e) =>
    logError("autosave before dream deploy failed", e, { dream_run_id: pending.id }),
  );

  let committed: string[] = [];
  const manifest = await readManifest(pending.id);
  const deletes = await readDraftDeletes(pending.id);
  const empty_patches = !(manifest?.entries.length) && !deletes.length;

  if (!empty_patches) {
    const result = await commitDraft(pending.id);
    committed = result.committed;
    await recordInitializedFromManifest(manifest);
  }

  pending.status = "committed";
  pending.committed_at = nowIso();
  pending.l1_clear_pending = true;
  await writeDreamRun(pending);

  try {
    await clearShortTermMemoryScope(pending.scope);
    pending.l1_clear_pending = false;
    await writeDreamRun(pending);
  } catch (e) {
    logError("l1 clear after commit failed", e, { dream_run_id: pending.id });
    // keep l1_clear_pending
  }

  const gitPaths = [...committed];
  if (!pending.l1_clear_pending) {
    gitPaths.push("memories/short-term-memory");
  }
  if (gitPaths.length > 0) {
    try {
      await stageAndCommitPaths(
        [...new Set(gitPaths)],
        `engram: dream ${pending.id}`,
      );
    } catch (e) {
      logError("git commit after dream deploy failed", e, { dream_run_id: pending.id });
      // Live deploy already applied; do not roll back L2 here — operator can inspect git status.
    }
  }

  await removeDraft(pending.id).catch(() => {});

  // 0.17: deploy 後不強制再 maintain（入夢前／GET 已覆蓋日曆語意）

  return {
    dream_run_id: pending.id,
    committed,
    cleared_scope: pending.l1_clear_pending ? [] : pending.scope,
    l1_clear_pending: !!pending.l1_clear_pending,
    empty_patches,
  };
}

/** Discard the active pending dream without mutating short-term or L2. */
export async function discardDream(opts?: { dream_run_id?: string }): Promise<{
  dream_run_id: string;
  discarded: true;
}> {
  const discarded = await discardPending(opts?.dream_run_id);
  if (!discarded) throw new NoPendingError();
  return { dream_run_id: discarded.id, discarded: true };
}

/** Indicates an action that requires a pending dream when none exists. */
export class NoPendingError extends Error {
  constructor() {
    super("no pending dream to act on");
    this.name = "NoPendingError";
  }
}

/** Indicates POST /dream/retry without a usable reason. */
export class MissingReasonError extends Error {
  constructor() {
    super("reason is required for dream retry");
    this.name = "MissingReasonError";
  }
}

/** Indicates day-chain patches that incorrectly target future dates. */
export class FutureChainIdError extends Error {
  rejected_chain_ids: string[];
  constructor(ids: string[]) {
    super(`future chain.id blocked: ${ids.join(", ")}`);
    this.name = "FutureChainIdError";
    this.rejected_chain_ids = ids;
  }
}

/** Indicates future-sight patches whose anchors have already expired. */
export class StaleFutureAnchorError extends Error {
  rejected_future_ids: string[];
  constructor(ids: string[]) {
    super(`stale future anchor blocked: ${ids.join(", ")}`);
    this.name = "StaleFutureAnchorError";
    this.rejected_future_ids = ids;
  }
}

/** Return a compact summary of the active pending dream. */
export async function pendingRunSummary(): Promise<{
  dream_run_id: string;
  scope_count: number;
  patch_count: number;
} | null> {
  const p = await getPendingRun();
  if (!p) return null;
  return {
    dream_run_id: p.id,
    scope_count: p.scope.length,
    patch_count: p.patch_count,
  };
}

export type { DreamRunState };

async function staleDraftFutureAnchorIds(dreamRunId: string): Promise<string[]> {
  const today = calendarDate();
  const listed = await listAnchors(draftDir(dreamRunId));
  return listed.filter((a) => a.anchor_end < today).map((a) => a.id).sort();
}

async function recordInitializedFromManifest(
  manifest: Awaited<ReturnType<typeof readManifest>>,
): Promise<void> {
  const byLevel: Record<HigherChainLevel, string[]> = {
    week: [],
    month: [],
    year: [],
  };
  for (const entry of manifest?.entries ?? []) {
    if (entry.op !== "create") continue;
    const level = entry.path.startsWith("memories/chain/weeks/")
      ? "week"
      : entry.path.startsWith("memories/chain/months/")
        ? "month"
        : entry.path.startsWith("memories/chain/years/")
          ? "year"
          : null;
    const id = entry.path.match(/\/([^/]+)\.summary\.md$/)?.[1];
    if (!level || !id) continue;
    byLevel[level].push(id);
  }
  for (const level of ["week", "month", "year"] as HigherChainLevel[]) {
    await addInitializedIds(level, byLevel[level]);
  }
}
