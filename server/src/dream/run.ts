/** Dream orchestration: extract, materialize, review, approve, and discard. */

import type { AgentRunner, ExtractContext, ReviewFeedback } from "../agent/types";
import { ClaudeCodeRunner } from "../agent/claude-code";
import { CursorCliRunner } from "../agent/cursor-cli";
import { MockFailRunner, MockOkRunner } from "../agent/mock";
import { acquireLock, releaseLock, isLocked, LockError } from "../store/lock";
import {
  readPoolEntriesForScope,
  listPoolEventIds,
  isL1Empty,
  clearL1Scope,
} from "../store/l1";
import { calendarDate, nowIso } from "../store/events";
import { makeRunId } from "../store/run-id";
import { listNodeIds, readAllWhatCurrents } from "../store/nodes";
import { readDay, readDaySummary } from "../store/chain";
import { appendPatchesIfNew, patchesForRun } from "../store/patches";
import type { Patch } from "./schema";
import { pendingDlqCount } from "../store/dlq";
import { readExtractState, writeExtractState } from "../store/extract-state";
import { logError, logDreamDebug } from "../log";
import { emitDreamEvent } from "./emit-event";
import { logExtractContext, summarizePatches } from "../agent/extract-log";
import { updateDreamJobPhase } from "../store/dream-job";
import { buildDreamReport } from "./report";
import {
  beginDreamRun,
  endDreamRun,
  throwIfDreamCancelled,
  DreamCancelledError,
  isDreamCancelled,
} from "./cancel-state";
import {
  draftSummary,
  futureChainIds,
  materializeDraft,
  commitDraft,
} from "../store/draft";
import { sweepExpiredFutureSight, staleFutureAnchorIds } from "../store/future-sight";
import { config } from "../config";
import {
  DreamRunMismatchError,
  discardPending,
  getL1ClearPendingRun,
  getPendingRun,
  newPendingRun,
  readReport,
  removeDraft,
  writeDreamRun,
  writeReport,
  type DreamRunState,
} from "../store/dream-runs";
import { formatRollupReportSection, runRollupCascade } from "./rollup";
import { pickRollupAgent } from "../agent/rollup";
import { addInitializedIds, type HigherChainLevel } from "../store/chain-higher";

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

/** Indicates a dream request with no L1 events to process. */
export class NothingToDreamError extends Error {
  constructor() {
    super("L1 pool is empty — nothing to dream");
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

/** Compact one-line descriptions of patches for retry context. */
export function compactPatchLines(patches: Patch[]): string[] {
  return patches.map((p) => {
    switch (p.type) {
      case "semantic":
        return `${p.patch_id}:semantic ${p.node}/${p.facet} ${p.operation}: ${p.content.slice(0, 160)}`;
      case "chain":
        return `${p.patch_id}:chain ${p.level}/${p.id} (${p.summary_operation ?? "?"}): ${(p.summary ?? p.content ?? "").slice(0, 160)}`;
      case "future":
        return `${p.patch_id}:future ${p.id} ${p.anchor_start}→${p.anchor_end}: ${p.content.slice(0, 160)}`;
      case "propose_node":
        return `${p.patch_id}:propose_node ${p.proposed_id}: ${p.reason.slice(0, 160)}`;
      case "episodic":
        return `${p.patch_id}:episodic ${p.node}: ${p.content.slice(0, 160)}`;
      default:
        return `${(p as Patch).patch_id}:${(p as Patch).type}`;
    }
  });
}

/** Build a short previous-attempt summary for retry feedback. */
export function formatPreviousSummary(
  draft: Awaited<ReturnType<typeof draftSummary>>,
  patches: Patch[],
): string {
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
  parts.push(`patches: ${patches.length}`);
  return parts.join("; ");
}

/** Create a collision-resistant identifier for a dream run. */
export function makeDreamRunId(at = nowIso()): string {
  return makeRunId("dream", at);
}

function pickRunner(): AgentRunner {
  const mode = process.env.ENGRAM_AGENT ?? "cursor";
  if (mode === "mock-fail") return new MockFailRunner();
  if (mode === "mock-ok") return new MockOkRunner();
  if (mode === "claude") return new ClaudeCodeRunner();
  return new CursorCliRunner();
}

/** Build the frozen L1, L2, and chain context supplied to an extraction runner. */
export async function buildExtractContext(
  dreamRunId: string,
  scope: string[],
  reviewFeedback?: ReviewFeedback,
): Promise<ExtractContext> {
  const scopeEntries = await readPoolEntriesForScope(scope);
  // L1 pool already holds id/ts/raw/node_refs for S — avoid readAllEvents() on huge L0 log.
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

  const chain_summaries_current: ExtractContext["chain_summaries_current"] = [];
  const chain_ledgers: NonNullable<ExtractContext["chain_ledgers"]> = [];
  for (const day of days) {
    chain_summaries_current.push({ day, current: await readDaySummary(day) });
    chain_ledgers.push({ day, content: await readDay(day) });
  }

  return {
    dream_run_id: dreamRunId,
    timezone: config.timezone,
    now: nowIso(),
    today,
    scope,
    l1: { summary: summary ? summary + "\n" : "", node_notes },
    events,
    l2_current,
    existing_nodes,
    chain_summaries_current,
    chain_ledgers,
    ...(reviewFeedback ? { review_feedback: reviewFeedback } : {}),
  };
}

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
    if (scope.length === 0 || (await isL1Empty())) {
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

    const prevPatches = await patchesForRun(pending.id);
    const prevDraft = await draftSummary(pending.id);
    const reviewFeedback: ReviewFeedback = {
      reason,
      previous_summary: formatPreviousSummary(prevDraft, prevPatches),
      previous_patches: compactPatchLines(prevPatches),
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

  const patches = await doExtract(dreamRunId, scope, runner, reviewFeedback);

  throwIfDreamCancelled(dreamRunId);

  await updateDreamJobPhase("materialize");
  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "materialize_start",
    message: `Materializing ${patches.length} patch(es)`,
    detail: {
      patches: patches.length,
      types: summarizePatches(patches),
    },
  });

  try {
    await materializeDraft(dreamRunId, patches, {
      shouldAbort: () => isDreamCancelled(dreamRunId),
    });
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
    message: "Draft materialized (day)",
  });

  let allPatches = patches;
  let rollupSection = "";
  try {
    throwIfDreamCancelled(dreamRunId);
    const { patches: rollupPatches, reports } = await runRollupCascade({
      dreamRunId,
      dayPatches: patches,
      agent: pickRollupAgent(),
    });
    if (rollupPatches.length > 0) {
      allPatches = [...patches, ...rollupPatches];
    }
    rollupSection = formatRollupReportSection(reports);
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
  const report =
    buildDreamReport({
      dream_run_id: dreamRunId,
      scope,
      events: poolEntries,
      patches: allPatches,
      review_feedback: reviewFeedback,
    }) + (rollupSection ? `\n${rollupSection}` : "");
  await writeReport(dreamRunId, report);

  const run = newPendingRun({
    id: dreamRunId,
    scope,
    patch_count: allPatches.length,
    retried_from: reviewFeedback?.retried_from,
    retry_reason: reviewFeedback?.reason,
  });
  await writeDreamRun(run);
  await writeExtractState({ status: "ok", dream_run_id: dreamRunId });

  emitDreamEvent(dreamRunId, {
    phase: "pending_review",
    event: "run_complete",
    message: `Ready for review (${allPatches.length} patches)`,
    detail: {
      patches: allPatches.length,
      future_chain: futureChainIds(allPatches),
      retried_from: reviewFeedback?.retried_from ?? null,
    },
  });

  return {
    dream_run_id: dreamRunId,
    scope,
    patch_count: allPatches.length,
    superseded: null,
    retried_from: reviewFeedback?.retried_from ?? null,
    extract_status: "ok",
    phase: "pending_review",
  };
}

async function doExtract(
  dreamRunId: string,
  scope: string[],
  runner?: AgentRunner,
  reviewFeedback?: ReviewFeedback,
): Promise<Patch[]> {
  const agent = runner ?? pickRunner();
  const ctx = await buildExtractContext(dreamRunId, scope, reviewFeedback);

  logExtractContext({
    dream_run_id: dreamRunId,
    events: ctx.events.length,
    l1_chars: ctx.l1.summary.length,
    node_notes: Object.keys(ctx.l1.node_notes).length,
    existing_nodes: ctx.existing_nodes.length,
    l2_nodes: ctx.l2_current.length,
  });

  let patches: Patch[];
  try {
    patches = await agent.extract(ctx);
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

  patches = patches.map((p) => ({ ...p, dream_run_id: dreamRunId }));

  const { patches: stored } = await appendPatchesIfNew(dreamRunId, patches);
  logDreamDebug("patches stored", {
    dream_run_id: dreamRunId,
    count: stored.length,
  });
  return stored;
}

/** High-level state reported for the dream pipeline. */
export type DreamStatus =
  | "ok"
  | "pending_review"
  | "dead_letter_pending"
  | "dream_incomplete"
  | "never_dreamed"
  | "l1_clear_pending";

/** Derive the current dream pipeline state from persistent records. */
export async function computeDreamStatus(): Promise<DreamStatus> {
  const pending = await getPendingRun();
  if (pending) return "pending_review";

  const clearPending = await getL1ClearPendingRun();
  if (clearPending) return "l1_clear_pending";

  const extractState = await readExtractState();
  const l1Empty = await isL1Empty();
  const dlq = await pendingDlqCount();

  if (extractState.status === "failed" && !l1Empty) {
    return "dream_incomplete";
  }

  if (extractState.status === "never") {
    return "never_dreamed";
  }

  if (dlq > 0) return "dead_letter_pending";
  return "ok";
}

/** Return the complete payload for the active pending dream, if any. */
export async function getPendingPayload(): Promise<{
  present: boolean;
  dream_run_id: string | null;
  scope: string[];
  report: string | null;
  patches: Patch[];
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
      patches: [],
      draft_summary: null,
    };
  }

  const patches = await patchesForRun(pending.id);
  const report = await readReport(pending.id);
  const draft_summary = await draftSummary(pending.id);

  return {
    present: true,
    dream_run_id: pending.id,
    scope: pending.scope,
    report,
    patches,
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

/** Commit the pending draft and clear its frozen L1 scope. */
export async function approveDream(opts?: { dream_run_id?: string }): Promise<ApproveResult> {
  // Retry path: commit already done, only clear L1
  const clearOnly = await getL1ClearPendingRun();
  if (clearOnly) {
    if (opts?.dream_run_id && opts.dream_run_id !== clearOnly.id) {
      throw new DreamRunMismatchError(clearOnly.id, opts.dream_run_id);
    }
    await clearL1Scope(clearOnly.scope);
    clearOnly.l1_clear_pending = false;
    await writeDreamRun(clearOnly);
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

  const patches = await patchesForRun(pending.id);
  const rejected = futureChainIds(patches);
  if (rejected.length > 0) {
    throw new FutureChainIdError(rejected);
  }
  const stale = staleFutureAnchorIds(patches);
  if (stale.length > 0) {
    throw new StaleFutureAnchorError(stale);
  }

  let committed: string[] = [];
  const empty_patches = patches.length === 0;

  if (!empty_patches) {
    const result = await commitDraft(pending.id);
    committed = result.committed;
    await recordInitializedFromPatches(patches);
  }

  pending.status = "committed";
  pending.committed_at = nowIso();
  pending.l1_clear_pending = true;
  await writeDreamRun(pending);

  try {
    await clearL1Scope(pending.scope);
    pending.l1_clear_pending = false;
    await writeDreamRun(pending);
  } catch (e) {
    logError("l1 clear after commit failed", e, { dream_run_id: pending.id });
    // keep l1_clear_pending
  }

  await removeDraft(pending.id).catch(() => {});

  // Lazy sweep after successful approve (best-effort)
  try {
    await sweepExpiredFutureSight();
  } catch (e) {
    logError("future-sight sweep after approve failed", e, { dream_run_id: pending.id });
  }

  return {
    dream_run_id: pending.id,
    committed,
    cleared_scope: pending.l1_clear_pending ? [] : pending.scope,
    l1_clear_pending: !!pending.l1_clear_pending,
    empty_patches,
  };
}

/** Discard the active pending dream without mutating L1 or L2. */
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

async function recordInitializedFromPatches(patches: Patch[]): Promise<void> {
  const byLevel: Record<HigherChainLevel, string[]> = {
    week: [],
    month: [],
    year: [],
  };
  for (const p of patches) {
    if (p.type !== "chain") continue;
    if (p.level === "week" || p.level === "month" || p.level === "year") {
      if (p.summary_operation === "init") {
        byLevel[p.level].push(p.id);
      }
    }
  }
  for (const level of ["week", "month", "year"] as HigherChainLevel[]) {
    await addInitializedIds(level, byLevel[level]);
  }
}
