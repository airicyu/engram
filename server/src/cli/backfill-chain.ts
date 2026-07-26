/**
 * Backfill week／month／year summaries from existing day chain (force execute).
 *
 * Usage:
 *   ENGRAM_HOME=… ENGRAM_AGENT=mock-ok bun run chain:backfill -- --level=month --until=2026-07
 *   ENGRAM_HOME=… bun run chain:backfill -- --level=all
 *
 * Uses a synthetic dream_run_id; writes patches + materializes + auto-commits
 * (engineering tool — not the interactive pending_review path).
 */

import { mkdir } from "node:fs/promises";
import { listChainDayIds, readDaySummary } from "../store/chain";
import {
  dayToMonthId,
  dayToYearId,
  isValidMonthId,
} from "../store/chain-time";
import { ensureEngramHome } from "../store/home";
import { config } from "../config";
import { makeDreamRunId } from "../dream/run";
import { runRollupCascade } from "../dream/rollup";
import { MockRollupAgent, pickRollupAgent } from "../agent/rollup";
import { materializeDraft, commitDraft } from "../store/draft";
import { addInitializedIds, type HigherChainLevel } from "../store/chain-higher";
import type { Patch } from "../dream/schema";
import { nowIso } from "../store/events";
import { draftDir } from "../store/dream-runs";

function parseArgs(argv: string[]) {
  let level: "week" | "month" | "year" | "all" = "all";
  let until: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--level=")) level = a.slice(8) as typeof level;
    else if (a === "--level") level = argv[++i] as typeof level;
    else if (a.startsWith("--until=")) until = a.slice(8);
    else if (a === "--until") until = argv[++i]!;
  }
  return { level, until };
}

function dayIncluded(dayId: string, until: string | null): boolean {
  if (!until) return true;
  if (isValidMonthId(until)) return dayToMonthId(dayId) <= until;
  if (/^\d{4}$/.test(until)) return dayToYearId(dayId) <= until;
  return dayId <= until;
}

async function main() {
  await ensureEngramHome();
  const { level, until } = parseArgs(process.argv.slice(2));
  console.log(`backfill under ${config.engramHome} level=${level} until=${until ?? "(none)"}`);

  const dayIds = (await listChainDayIds()).filter((d) => dayIncluded(d, until));
  if (dayIds.length === 0) {
    console.log("no day ids to backfill");
    return;
  }

  const ts = nowIso();
  const dreamRunId = makeDreamRunId();
  const dayPatches: Patch[] = [];
  for (const id of dayIds) {
    const summary = await readDaySummary(id);
    if (!summary.trim()) continue;
    dayPatches.push({
      type: "chain",
      patch_id: `p-backfill-day-${id}`,
      dream_run_id: dreamRunId,
      ts,
      level: "day",
      id,
      content: `(backfill marker for ${id})`,
      summary,
      summary_operation: "revise",
    });
  }

  const forceLevels: HigherChainLevel[] =
    level === "week" || level === "month" || level === "year"
      ? [level]
      : ["week", "month", "year"];

  await mkdir(draftDir(dreamRunId), { recursive: true });
  await materializeDraft(dreamRunId, []);

  const agent =
    process.env.ENGRAM_AGENT === "mock-ok" || process.env.ENGRAM_AGENT?.startsWith("mock")
      ? new MockRollupAgent()
      : pickRollupAgent();

  const { patches, reports } = await runRollupCascade({
    dreamRunId,
    dayPatches,
    agent,
    forceLevels,
  });

  console.log("reports:", JSON.stringify(reports, null, 2));
  if (patches.length === 0) {
    console.log("no higher patches produced");
    return;
  }

  const { committed } = await commitDraft(dreamRunId);
  const byLevel: Record<HigherChainLevel, string[]> = { week: [], month: [], year: [] };
  for (const p of patches) {
    if (p.type !== "chain") continue;
    if (p.level === "week" || p.level === "month" || p.level === "year") {
      if (p.summary_operation === "init") byLevel[p.level].push(p.id);
    }
  }
  for (const lv of forceLevels) {
    await addInitializedIds(lv, byLevel[lv]);
  }

  console.log(`committed ${committed.length} paths`);
  for (const c of committed) console.log(`  ${c}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
