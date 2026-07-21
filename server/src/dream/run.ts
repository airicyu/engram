import type { AgentRunner, ExtractContext } from "../agent/types";
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
import { readAllEvents, taipeiNowIso } from "../store/events";
import { listNodeIds, readAllWhatCurrents } from "../store/nodes";
import { appendPatchesIfNew, patchesForRun } from "../store/patches";
import type { Patch } from "./schema";
import { pendingDlqCount } from "../store/dlq";
import { readExtractState, writeExtractState } from "../store/extract-state";
import { logError, logDream, logDreamDebug } from "../log";
import { logExtractContext, summarizePatches } from "../agent/extract-log";
import { buildDreamReport } from "./report";
import {
  draftSummary,
  futureChainIds,
  materializeDraft,
  commitDraft,
} from "../store/draft";
import {
  DreamRunMismatchError,
  discardPending,
  getL1ClearPendingRun,
  getPendingRun,
  newPendingRun,
  readReport,
  removeDraft,
  supersedePending,
  writeDreamRun,
  writeReport,
  type DreamRunState,
} from "../store/dream-runs";

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

export class NothingToDreamError extends Error {
  constructor() {
    super("L1 pool is empty — nothing to dream");
    this.name = "NothingToDreamError";
  }
}

export function makeDreamRunId(nowIso = taipeiNowIso()): string {
  return `dream-${nowIso}`;
}

function pickRunner(): AgentRunner {
  const mode = process.env.ENGRAM_AGENT ?? "cursor";
  if (mode === "mock-fail") return new MockFailRunner();
  if (mode === "mock-ok") return new MockOkRunner();
  if (mode === "claude") return new ClaudeCodeRunner();
  return new CursorCliRunner();
}

export async function buildExtractContext(
  dreamRunId: string,
  scope: string[],
): Promise<ExtractContext> {
  const scopeEntries = await readPoolEntriesForScope(scope);
  const allEvents = await readAllEvents();
  const byId = new Map(allEvents.map((e) => [e.id, e]));
  const events = scope
    .map((id) => byId.get(id))
    .filter((e): e is NonNullable<typeof e> => !!e);

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

  return {
    dream_run_id: dreamRunId,
    timezone: "Asia/Taipei",
    scope,
    l1: { summary: summary ? summary + "\n" : "", node_notes },
    events: events.map((e) => ({
      id: e.id,
      ts: e.ts,
      raw: e.raw,
      node_refs: e.node_refs,
    })),
    l2_current,
    existing_nodes,
  };
}

export interface DreamRunResult {
  dream_run_id: string;
  scope: string[];
  patch_count: number;
  superseded: string | null;
  extract_status: "ok";
  phase: "pending_review";
}

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

  try {
    const scope = await listPoolEventIds();
    if (scope.length === 0 || (await isL1Empty())) {
      throw new NothingToDreamError();
    }

    const superseded = await supersedePending(dreamRunId);

    logDream("extract start", {
      dream_run_id: dreamRunId,
      scope: scope.length,
      superseded: superseded?.id ?? null,
    });

    const patches = await doExtract(dreamRunId, scope, opts?.runner);

    logDream("materialize start", {
      dream_run_id: dreamRunId,
      patches: patches.length,
      types: summarizePatches(patches),
    });

    try {
      await materializeDraft(dreamRunId, patches);
    } catch (e) {
      await removeDraft(dreamRunId).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      throw new DreamIncompleteError(dreamRunId, msg, "materialize");
    }

    const poolEntries = await readPoolEntriesForScope(scope);
    const report = buildDreamReport({
      dream_run_id: dreamRunId,
      scope,
      events: poolEntries,
      patches,
    });
    await writeReport(dreamRunId, report);

    const run = newPendingRun({
      id: dreamRunId,
      scope,
      patch_count: patches.length,
    });
    await writeDreamRun(run);
    await writeExtractState({ status: "ok", dream_run_id: dreamRunId });

    logDream("pending_review ready", {
      dream_run_id: dreamRunId,
      patches: patches.length,
      future_chain: futureChainIds(patches),
    });

    return {
      dream_run_id: dreamRunId,
      scope,
      patch_count: patches.length,
      superseded: superseded?.id ?? null,
      extract_status: "ok",
      phase: "pending_review",
    };
  } catch (e) {
    if (e instanceof DreamIncompleteError) {
      logError("dream incomplete", e, { dream_run_id: e.dream_run_id, phase: e.phase });
      await writeExtractState({
        status: "failed",
        dream_run_id: e.dream_run_id,
        message: e.message,
      });
    }
    throw e;
  } finally {
    if (!opts?.lockAlreadyHeld) {
      await releaseLock();
    }
  }
}

async function doExtract(
  dreamRunId: string,
  scope: string[],
  runner?: AgentRunner,
): Promise<Patch[]> {
  const agent = runner ?? pickRunner();
  const ctx = await buildExtractContext(dreamRunId, scope);

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
    logDreamDebug("extract failed", {
      dream_run_id: dreamRunId,
      error: e instanceof Error ? e.message : String(e),
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

export type DreamStatus =
  | "ok"
  | "pending_review"
  | "dead_letter_pending"
  | "dream_incomplete"
  | "never_dreamed"
  | "l1_clear_pending";

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

export async function getPendingPayload(): Promise<{
  present: boolean;
  dream_run_id: string | null;
  scope: string[];
  report: string | null;
  patches: Patch[];
  draft_summary: { entry_count: number; chain_days: string[] } | null;
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

export interface ApproveResult {
  dream_run_id: string;
  committed: string[];
  cleared_scope: string[];
  l1_clear_pending: boolean;
  empty_patches: boolean;
}

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

  let committed: string[] = [];
  const empty_patches = patches.length === 0;

  if (!empty_patches) {
    const result = await commitDraft(pending.id);
    committed = result.committed;
  }

  pending.status = "committed";
  pending.committed_at = taipeiNowIso();
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

  return {
    dream_run_id: pending.id,
    committed,
    cleared_scope: pending.l1_clear_pending ? [] : pending.scope,
    l1_clear_pending: !!pending.l1_clear_pending,
    empty_patches,
  };
}

export async function discardDream(opts?: { dream_run_id?: string }): Promise<{
  dream_run_id: string;
  discarded: true;
}> {
  const discarded = await discardPending(opts?.dream_run_id);
  if (!discarded) throw new NoPendingError();
  return { dream_run_id: discarded.id, discarded: true };
}

export class NoPendingError extends Error {
  constructor() {
    super("no pending dream to act on");
    this.name = "NoPendingError";
  }
}

export class FutureChainIdError extends Error {
  rejected_chain_ids: string[];
  constructor(ids: string[]) {
    super(`future chain.id blocked: ${ids.join(", ")}`);
    this.name = "FutureChainIdError";
    this.rejected_chain_ids = ids;
  }
}

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
