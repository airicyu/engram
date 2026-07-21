import type { Patch } from "./schema";
import { isApplied, markApplied } from "../store/applied";
import { appendDlq, isPatchInDlq } from "../store/dlq";
import { applySemanticWhat } from "../store/nodes";
import { applyChainDay } from "../store/chain";
import { upsertNodeCandidate, upsertAttributionCandidate } from "../store/candidates";
import { nodeExists } from "../store/nodes";
import { clearL1 } from "../store/l1";
import { taipeiDate } from "../store/events";
import { logDream, logDreamDebug } from "../log";

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  dead_letter: string[];
}

export async function applyPatches(patches: Patch[], dreamRunId?: string): Promise<ApplyResult> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const dead_letter: string[] = [];

  for (const patch of patches) {
    if (await isApplied(patch.patch_id)) {
      skipped.push(patch.patch_id);
      logDreamDebug("patch skipped (already applied)", {
        dream_run_id: dreamRunId,
        patch_id: patch.patch_id,
        type: patch.type,
      });
      continue;
    }
    if (await isPatchInDlq(patch.patch_id)) {
      skipped.push(patch.patch_id);
      logDreamDebug("patch skipped (in dlq)", {
        dream_run_id: dreamRunId,
        patch_id: patch.patch_id,
        type: patch.type,
      });
      continue;
    }

    try {
      await applyOne(patch);
      await markApplied(patch.patch_id);
      applied.push(patch.patch_id);
      logDreamDebug("patch applied", {
        dream_run_id: dreamRunId,
        patch_id: patch.patch_id,
        type: patch.type,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const dlId = await appendDlq(patch, msg);
      dead_letter.push(dlId);
      logDream("patch dead-letter", {
        dream_run_id: dreamRunId,
        patch_id: patch.patch_id,
        type: patch.type,
        dlq_id: dlId,
        error: msg,
      });
    }
  }

  return { applied, skipped, dead_letter };
}

async function applyOne(patch: Patch): Promise<void> {
  switch (patch.type) {
    case "semantic": {
      if (!(await nodeExists(patch.node))) {
        throw new Error(`node does not exist: ${patch.node}`);
      }
      await applySemanticWhat({
        nodeId: patch.node,
        operation: patch.operation,
        content: patch.content,
        patchId: patch.patch_id,
        eventRefs: patch.event_refs ?? [],
        date: taipeiDate(patch.ts),
      });
      return;
    }
    case "chain": {
      await applyChainDay({
        dayId: patch.id,
        content: patch.content,
        patchId: patch.patch_id,
        eventRefs: patch.event_refs ?? [],
      });
      return;
    }
    case "propose_node": {
      await upsertNodeCandidate({
        proposed_id: patch.proposed_id,
        kind: patch.kind,
        aliases: patch.aliases ?? [],
        reason: patch.reason,
        evidence_event_refs: patch.evidence_event_refs ?? patch.event_refs ?? [],
        seed_facets: patch.seed_facets,
        patch_id: patch.patch_id,
      });
      return;
    }
    case "episodic": {
      if (!(await nodeExists(patch.node))) {
        throw new Error(`node does not exist: ${patch.node}`);
      }
      if (patch.confidence < 0.6) {
        await upsertAttributionCandidate({
          node: patch.node,
          role: patch.role,
          confidence: patch.confidence,
          date: patch.date,
          content: patch.content,
          event_refs: patch.event_refs ?? [],
          patch_id: patch.patch_id,
        });
        return;
      }
      // P1–P2: confidence ≥ 0.6 — skip chronology write (Phase 4)
      return;
    }
    case "dlq_review":
      // Prototype: no adhoc DLQ review apply
      throw new Error("dlq_review apply not supported in prototype");
    default: {
      const _exhaustive: never = patch;
      throw new Error(`unhandled patch: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Apply then clear L1 (even if some patches went to DLQ). */
export async function applyAndClearL1(patches: Patch[], dreamRunId?: string): Promise<ApplyResult> {
  const result = await applyPatches(patches, dreamRunId);
  await clearL1();
  logDreamDebug("l1 cleared", { dream_run_id: dreamRunId });
  return result;
}
