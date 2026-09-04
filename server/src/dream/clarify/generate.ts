/**
 * Clarify generate job: agent returns structured prompts → server validates,
 * writes live asking/, prunes to ≤10, git commits. Agent has no live memories write.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../../config";
import { calendarDate, nowIso } from "../../store/memories/activities";
import {
  CLARIFY_ASKING_CAP,
  CLARIFY_GENERATE_MAX,
  CLARIFY_GENERATE_MIN,
  ClarifyValidationError,
  commitClarifyPaths,
  deleteAskingFile,
  listAskingItems,
  pruneAskingToCap,
  withClarifyWriteLock,
  writeAskingFile,
} from "../../store/memories/clarify";
import { listNodeIds } from "../../store/memories/nodes";
import { readNodeScore } from "../../store/memories/node-score";
import { readInvolvementsForPending } from "../score/involvements";
import { createClarifyGenerateAgent } from "../../agent/factory";
import type { ClarifyGenerateAgent, ClarifyGenerateResult } from "../../agent/clarify/types";
import { emitDreamEvent } from "../report/emit-event";
import { logError, logInfo } from "../../log";
import { readReport } from "../../store/dreams/dream-runs";

export async function selectClarifyGenerateCandidates(dreamRunId: string): Promise<string[]> {
  const ids = await listNodeIds();
  if (ids.length === 0) return [];

  const involvements = await readInvolvementsForPending(dreamRunId);
  const avoid = new Set(
    involvements
      .filter((r) => r.category === "update" || r.category === "focus")
      .map((r) => r.id),
  );

  const scored: Array<{ id: string; score: number }> = [];
  for (const id of ids) {
    const s = await readNodeScore(id);
    scored.push({ id, score: s?.score ?? Number.NEGATIVE_INFINITY });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const preferred = scored.filter((x) => !avoid.has(x.id)).map((x) => x.id);
  const avoided = scored.filter((x) => avoid.has(x.id)).map((x) => x.id);
  const ordered = [...preferred, ...avoided];
  return ordered.slice(0, 8);
}

function extractNarrativeExcerpt(report: string | null): string {
  if (!report) return "";
  const m = report.match(
    /## Narrative\s*\n([\s\S]*?)(?=\n## Node score involvements\b|\n## Clarify distill\b|\n## Structure notes\b|\n## Appendix — pending deploy\b|$)/,
  );
  const body = (m?.[1] ?? "").trim();
  if (body.length <= 4000) return body;
  return body.slice(0, 4000);
}

/** Server-side land of generate prompts into asking/. */
export async function landClarifyGeneratePrompts(opts: {
  dreamRunId: string;
  result: ClarifyGenerateResult;
}): Promise<{ written_ids: string[]; pruned_ids: string[] }> {
  const { dreamRunId, result } = opts;
  const written: string[] = [];

  return withClarifyWriteLock(async () => {
    const specs = (result.prompts ?? []).slice(0, CLARIFY_GENERATE_MAX);
    if (specs.length > 0 && specs.length < CLARIFY_GENERATE_MIN) {
      logInfo("clarify_generate: reject batch below min", {
        count: specs.length,
        min: CLARIFY_GENERATE_MIN,
      });
      return { written_ids: [], pruned_ids: [] };
    }

    // Apply agent prune list first (true delete) — only when landing a valid batch or empty
    for (const id of result.prune_asking_ids ?? []) {
      await deleteAskingFile(id);
    }

    const batchIds: string[] = [];
    try {
      for (const spec of specs) {
        const question = typeof spec.question === "string" ? spec.question.trim() : "";
        if (!question) {
          logInfo("clarify_generate: skip empty question");
          continue;
        }
        let related: string[] = [];
        try {
          // reuse writeAskingFile validation via related_nodes
          related = Array.isArray(spec.related_nodes)
            ? spec.related_nodes.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim())
            : [];
          // dedupe
          related = [...new Set(related)];
          if (related.length > 16) {
            logInfo("clarify_generate: skip prompt — related_nodes > 16");
            continue;
          }
        } catch {
          continue;
        }
        const id = crypto.randomUUID();
        try {
          await writeAskingFile({
            id,
            question,
            source_dream_run_id: dreamRunId,
            related_nodes: related,
          });
          batchIds.push(id);
          written.push(id);
        } catch (e) {
          if (e instanceof ClarifyValidationError) {
            logInfo("clarify_generate: skip invalid prompt", { error: e.error, message: e.message });
            continue;
          }
          // Roll back this batch on hard failure
          for (const wid of batchIds) await deleteAskingFile(wid).catch(() => {});
          throw e;
        }
      }

      const pruned = await pruneAskingToCap(dreamRunId);
      if (written.length || pruned.length || (result.prune_asking_ids?.length ?? 0) > 0) {
        await commitClarifyPaths(`engram: clarify generate ${dreamRunId}`);
      }
      return { written_ids: written, pruned_ids: pruned };
    } catch (e) {
      for (const wid of batchIds) await deleteAskingFile(wid).catch(() => {});
      throw e;
    }
  });
}

export async function runClarifyGenerate(opts: {
  dreamRunId: string;
  week_rollup_executed: boolean;
  agent?: ClarifyGenerateAgent;
}): Promise<{ written_ids: string[]; pruned_ids: string[]; noop: boolean }> {
  const { dreamRunId, week_rollup_executed } = opts;
  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "clarify_generate",
    message: "Clarify generate start",
  });

  const nodeCount = (await listNodeIds()).length;
  if (nodeCount === 0) {
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "clarify_generate",
      message: "Clarify generate no-op (no nodes in store)",
    });
    return { written_ids: [], pruned_ids: [], noop: true };
  }

  const asking = await listAskingItems();
  if (asking.length >= CLARIFY_ASKING_CAP) {
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "clarify_generate",
      message: "Clarify generate no-op (asking at cap)",
      detail: { asking_count: asking.length, asking_cap: CLARIFY_ASKING_CAP },
    });
    return { written_ids: [], pruned_ids: [], noop: true };
  }

  if (!week_rollup_executed) {
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "clarify_generate",
      message: "Clarify generate no-op (no week rollup this run)",
    });
    return { written_ids: [], pruned_ids: [], noop: true };
  }

  const candidates = await selectClarifyGenerateCandidates(dreamRunId);
  const report = await readReport(dreamRunId);
  const narrative = extractNarrativeExcerpt(report);

  const workDir = await mkdtemp(join(config.tempDir || tmpdir(), "engram-clarify-gen-"));
  try {
    const agent = opts.agent ?? createClarifyGenerateAgent();
    const asking = await listAskingItems();
    let result: ClarifyGenerateResult;
    try {
      result = await agent.generate({
        dream_run_id: dreamRunId,
        timezone: config.timezone,
        memory_language: config.memoryLanguage,
        now: nowIso(),
        today: calendarDate(),
        store_dir: config.storeDir,
        work_dir: workDir,
        dream_narrative_excerpt: narrative,
        candidate_node_ids: candidates,
        existing_asking_count: asking.length,
        asking_cap: CLARIFY_ASKING_CAP,
        generate_min: CLARIFY_GENERATE_MIN,
        generate_max: CLARIFY_GENERATE_MAX,
      });
    } catch (e) {
      logError("clarify_generate agent failed", e, { dream_run_id: dreamRunId });
      throw e;
    }

    const landed = await landClarifyGeneratePrompts({ dreamRunId, result });
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "clarify_generate",
      message: `Clarify generate done (wrote ${landed.written_ids.length}, pruned ${landed.pruned_ids.length})`,
      detail: landed,
    });
    return { ...landed, noop: false };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
