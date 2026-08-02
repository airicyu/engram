/** Pending-dream inspection, approval, and discard. */

import { calendarDate, nowIso } from "../../store/memories/activities";
import { draftSummary, commitDraft, readManifest } from "../../store/dreams/draft";
import {
  discardPending,
  getPendingRun,
  getShortTermClearPendingRun,
  readReport,
  removeDraft,
  writeDreamRun,
  draftDir,
  type DreamRunState,
} from "../../store/dreams/dream-runs";
import { clearShortTermMemoryScope, isShortTermMemoryEmpty } from "../../store/memories/short-term-memory";
import { readExtractState } from "../../store/dreams/extract-state";
import { maintainFutureSight, listAnchors } from "../../store/memories/future-sight";
import { readDraftDeletes, finalizeDraftFromDisk } from "../../store/dreams/file-pipeline";
import { commitDirtyMemorySnapshot, stageAndCommitPaths } from "../../store/git";
import { logError } from "../../log";
import { addInitializedIds, type HigherChainLevel } from "../../store/memories/chain-higher";
import { readInvolvementsForPending, settleNodeScoresOnApprove } from "../score/involvements";
import {
  FutureChainIdError,
  NoPendingError,
  StaleFutureAnchorError,
} from "../shared/errors";
import { DreamRunMismatchError } from "../../store/dreams/dream-runs";

export type DreamStatus = "ok" | "pending_review" | "dream_incomplete" | "never_dreamed" | "l1_clear_pending";

/** Derive the current dream pipeline state from persistent records. */
export async function computeDreamStatus(): Promise<DreamStatus> {
  if (await getPendingRun()) return "pending_review";
  if (await getShortTermClearPendingRun()) return "l1_clear_pending";
  const extractState = await readExtractState();
  if (extractState.status === "failed" && !(await isShortTermMemoryEmpty())) return "dream_incomplete";
  return extractState.status === "never" ? "never_dreamed" : "ok";
}

/** Return the complete payload for the active pending dream, if any. */
export async function getPendingPayload(): Promise<{
  present: boolean;
  dream_run_id: string | null;
  scope: string[];
  report: string | null;
  draft_summary: Awaited<ReturnType<typeof draftSummary>>;
  node_score_involvements: Array<{ id: string; category: string; reason?: string }>;
}> {
  const pending = await getPendingRun();
  if (!pending) {
    return { present: false, dream_run_id: null, scope: [], report: null, draft_summary: null, node_score_involvements: [] };
  }
  const [report, draft_summary, involvements] = await Promise.all([
    readReport(pending.id),
    draftSummary(pending.id),
    readInvolvementsForPending(pending.id),
  ]);
  return {
    present: true, dream_run_id: pending.id, scope: pending.scope, report, draft_summary,
    node_score_involvements: involvements.map((r) => ({
      id: r.id, category: r.category, ...(r.reason ? { reason: r.reason } : {}),
    })),
  };
}

export interface ApproveResult {
  dream_run_id: string;
  committed: string[];
  cleared_scope: string[];
  l1_clear_pending: boolean;
  empty_patches: boolean;
}

/** Commit the pending draft and clear its frozen short-term scope. */
export async function approveDream(opts?: { dream_run_id?: string }): Promise<ApproveResult> {
  const clearOnly = await getShortTermClearPendingRun();
  if (clearOnly) {
    if (opts?.dream_run_id && opts.dream_run_id !== clearOnly.id) {
      throw new DreamRunMismatchError(clearOnly.id, opts.dream_run_id);
    }
    await clearShortTermMemoryScope(clearOnly.scope);
    clearOnly.l1_clear_pending = false;
    await writeDreamRun(clearOnly);
    await stageAndCommitPaths(["memories/short-term-memory"], `engram: dream ${clearOnly.id} (scope clear)`)
      .catch((e) => logError("git commit after scope clear failed", e, { dream_run_id: clearOnly.id }));
    return {
      dream_run_id: clearOnly.id, committed: [], cleared_scope: clearOnly.scope,
      l1_clear_pending: false, empty_patches: clearOnly.patch_count === 0,
    };
  }
  const pending = await getPendingRun();
  if (!pending) throw new NoPendingError();
  if (opts?.dream_run_id && opts.dream_run_id !== pending.id) {
    throw new DreamRunMismatchError(pending.id, opts.dream_run_id);
  }
  const draft = await draftSummary(pending.id);
  const rejected = [...new Set([...(draft?.chain_days ?? []), ...(draft?.chain_summary_days ?? [])])]
    .filter((id) => id > calendarDate()).sort();
  if (rejected.length > 0) throw new FutureChainIdError(rejected);

  const draftRoot = draftDir(pending.id);
  const draftMaint = await maintainFutureSight({ mode: "full", target: "draft", baseDir: draftRoot, commit: false });
  if (draftMaint.stale_expired.length > 0) throw new StaleFutureAnchorError(draftMaint.stale_expired);
  if (draftMaint.changed) await finalizeDraftFromDisk(pending.id);
  const stale = await staleDraftFutureAnchorIds(pending.id);
  if (stale.length > 0) throw new StaleFutureAnchorError(stale);

  await commitDirtyMemorySnapshot(`engram: autosave before ${pending.id}`)
    .catch((e) => logError("autosave before dream deploy failed", e, { dream_run_id: pending.id }));
  const manifest = await readManifest(pending.id);
  const deletes = await readDraftDeletes(pending.id);
  const empty_patches = !(manifest?.entries.length) && !deletes.length;
  let committed: string[] = [];
  let scorePaths: string[] = [];
  if (!empty_patches) {
    committed = (await commitDraft(pending.id)).committed;
    await recordInitializedFromManifest(manifest);
    try {
      scorePaths = await settleNodeScoresOnApprove({ dream_run_id: pending.id, as_of: nowIso(), manifest });
    } catch (e) {
      logError("node-score settle after commit failed", e, { dream_run_id: pending.id });
    }
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
  }
  const gitPaths = [...committed, ...scorePaths];
  if (!pending.l1_clear_pending) gitPaths.push("memories/short-term-memory");
  if (gitPaths.length > 0) {
    await stageAndCommitPaths([...new Set(gitPaths)], `engram: dream ${pending.id}`)
      .catch((e) => logError("git commit after dream deploy failed", e, { dream_run_id: pending.id }));
  }
  await removeDraft(pending.id).catch(() => {});
  return {
    dream_run_id: pending.id, committed,
    cleared_scope: pending.l1_clear_pending ? [] : pending.scope,
    l1_clear_pending: !!pending.l1_clear_pending, empty_patches,
  };
}

/** Discard the active pending dream without mutating short-term or L2. */
export async function discardDream(opts?: { dream_run_id?: string }): Promise<{ dream_run_id: string; discarded: true }> {
  const discarded = await discardPending(opts?.dream_run_id);
  if (!discarded) throw new NoPendingError();
  return { dream_run_id: discarded.id, discarded: true };
}

/** Return a compact summary of the active pending dream. */
export async function pendingRunSummary(): Promise<{ dream_run_id: string; scope_count: number; patch_count: number } | null> {
  const p = await getPendingRun();
  return p ? { dream_run_id: p.id, scope_count: p.scope.length, patch_count: p.patch_count } : null;
}

export async function staleDraftFutureAnchorIds(dreamRunId: string): Promise<string[]> {
  const today = calendarDate();
  return (await listAnchors(draftDir(dreamRunId))).filter((a) => a.anchor_end < today).map((a) => a.id).sort();
}

export async function recordInitializedFromManifest(
  manifest: Awaited<ReturnType<typeof readManifest>>,
): Promise<void> {
  const byLevel: Record<HigherChainLevel, string[]> = { week: [], month: [], year: [] };
  for (const entry of manifest?.entries ?? []) {
    if (entry.op !== "create") continue;
    const level = entry.path.startsWith("memories/chain/weeks/") ? "week"
      : entry.path.startsWith("memories/chain/months/") ? "month"
        : entry.path.startsWith("memories/chain/years/") ? "year" : null;
    const id = entry.path.match(/\/([^/]+)\.summary\.md$/)?.[1];
    if (level && id) byLevel[level].push(id);
  }
  for (const level of ["week", "month", "year"] as HigherChainLevel[]) {
    await addInitializedIds(level, byLevel[level]);
  }
}

export type { DreamRunState };
