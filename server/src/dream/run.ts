import type { AgentRunner, ExtractContext } from "../agent/types";
import { ClaudeCodeRunner } from "../agent/claude-code";
import { CursorCliRunner } from "../agent/cursor-cli";
import { MockFailRunner, MockOkRunner } from "../agent/mock";
import { acquireLock, releaseLock, isLocked, LockError } from "../store/lock";
import { readSummary, readAllNodeNotes, isL1Empty } from "../store/l1";
import { eventsForDay, taipeiDate, taipeiNowIso } from "../store/events";
import { listNodeIds, readAllWhatCurrents } from "../store/nodes";
import { appendPatchesIfNew, hasPatchesForRun, patchesForRun, readAllPatches } from "../store/patches";
import { isApplied } from "../store/applied";
import { applyAndClearL1 } from "./apply";
import type { Patch } from "./schema";
import { pendingDlqCount } from "../store/dlq";
import { readExtractState, writeExtractState } from "../store/extract-state";
import { logError, logDream, logDreamDebug } from "../log";
import { logExtractContext, summarizePatches } from "../agent/extract-log";

export class DreamIncompleteError extends Error {
  dream_run_id: string;
  constructor(dream_run_id: string, message: string) {
    super(message);
    this.name = "DreamIncompleteError";
    this.dream_run_id = dream_run_id;
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

export async function buildExtractContext(dreamRunId: string): Promise<ExtractContext> {
  const day = taipeiDate();
  const events = await eventsForDay(day);
  const summary = await readSummary();
  const node_notes = await readAllNodeNotes();
  const existing_nodes = await listNodeIds();
  const l2_current = await readAllWhatCurrents();

  return {
    dream_run_id: dreamRunId,
    timezone: "Asia/Taipei",
    l1: { summary, node_notes },
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

async function findResumableRunId(): Promise<string | null> {
  // Resume: L1 not clear + patches exist for some run + apply not fully done
  if (await isL1Empty()) return null;

  const all = await readAllPatches();
  if (all.length === 0) return null;

  const byRun = new Map<string, Patch[]>();
  for (const p of all) {
    const list = byRun.get(p.dream_run_id) ?? [];
    list.push(p);
    byRun.set(p.dream_run_id, list);
  }

  const runIds = [...byRun.keys()].reverse();
  for (const id of runIds) {
    const patches = byRun.get(id)!;
    for (const p of patches) {
      if (!(await isApplied(p.patch_id))) return id;
    }
  }
  return null;
}

export interface DreamRunResult {
  dream_run_id: string;
  applied: string[];
  skipped: string[];
  dead_letter: string[];
  extract_status: "ok" | "skipped_resume";
  resumed: boolean;
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

  const resumeId = opts?.dream_run_id ?? (await findResumableRunId());
  let dreamRunId = opts?.dream_run_id ?? resumeId ?? makeDreamRunId();
  let resumed = false;
  let patches: Patch[];
  let extract_status: "ok" | "skipped_resume" = "ok";

  try {
    const existing = await hasPatchesForRun(dreamRunId);
    const l1Empty = await isL1Empty();

    if (existing && !l1Empty) {
      // Resume apply only
      resumed = true;
      extract_status = "skipped_resume";
      patches = await patchesForRun(dreamRunId);
      logDream("resume apply", { dream_run_id: dreamRunId, patches: patches.length });
    } else if (existing && l1Empty) {
      // L1 already cleared — allow new extract with new id
      dreamRunId = makeDreamRunId();
      logDream("extract (new id after cleared L1)", { dream_run_id: dreamRunId });
      patches = await doExtract(dreamRunId, opts?.runner);
    } else {
      logDream("extract start", { dream_run_id: dreamRunId });
      patches = await doExtract(dreamRunId, opts?.runner);
    }

    logDream("apply start", {
      dream_run_id: dreamRunId,
      patches: patches.length,
      types: summarizePatches(patches),
    });
    const result = await applyAndClearL1(patches, dreamRunId);
    await writeExtractState({ status: "ok", dream_run_id: dreamRunId });
    logDream("apply done", {
      dream_run_id: dreamRunId,
      applied: result.applied.length,
      skipped: result.skipped.length,
      dead_letter: result.dead_letter.length,
    });
    return {
      dream_run_id: dreamRunId,
      applied: result.applied,
      skipped: result.skipped,
      dead_letter: result.dead_letter,
      extract_status,
      resumed,
    };
  } catch (e) {
    if (e instanceof DreamIncompleteError) {
      logError("dream incomplete", e, { dream_run_id: e.dream_run_id });
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

async function doExtract(dreamRunId: string, runner?: AgentRunner): Promise<Patch[]> {
  const agent = runner ?? pickRunner();
  const ctx = await buildExtractContext(dreamRunId);

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
    );
  }

  // Stamp dream_run_id on all patches if agent omitted / mismatched
  patches = patches.map((p) => ({ ...p, dream_run_id: dreamRunId }));

  const { patches: stored } = await appendPatchesIfNew(dreamRunId, patches);
  logDreamDebug("patches stored", {
    dream_run_id: dreamRunId,
    count: stored.length,
  });
  return stored;
}

export async function computeDreamStatus(): Promise<
  "ok" | "dead_letter_pending" | "dream_incomplete" | "never_dreamed"
> {
  const extractState = await readExtractState();
  const l1Empty = await isL1Empty();
  const dlq = await pendingDlqCount();
  const patches = await readAllPatches();

  // Extract failed and L1 retained
  if (extractState.status === "failed" && !l1Empty) {
    return "dream_incomplete";
  }

  // Unapplied patches while L1 still present → incomplete / resume-able
  if (!l1Empty && patches.length > 0) {
    const byRun = new Map<string, Patch[]>();
    for (const p of patches) {
      const list = byRun.get(p.dream_run_id) ?? [];
      list.push(p);
      byRun.set(p.dream_run_id, list);
    }
    const latest = [...byRun.keys()].pop();
    if (latest) {
      for (const p of byRun.get(latest)!) {
        if (!(await isApplied(p.patch_id))) return "dream_incomplete";
      }
    }
  }

  if (patches.length === 0 && extractState.status === "never") {
    return "never_dreamed";
  }

  if (dlq > 0) return "dead_letter_pending";
  if (patches.length === 0) return "never_dreamed";
  return "ok";
}
