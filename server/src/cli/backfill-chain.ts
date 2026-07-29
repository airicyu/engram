/**
 * Backfill week／month／year summaries from existing day chain (force execute).
 *
 * Usage:
 *   ENGRAM_STORE_DIR=… ENGRAM_AGENT=mock-ok bun run chain:backfill -- --level=month --until=2026-07
 *   ENGRAM_STORE_DIR=… bun run chain:backfill -- --level=all
 *
 * Uses a synthetic dream_run_id; writes draft files + auto-commits
 * (engineering tool — not the interactive pending_review path).
 */

import { listChainDayIds, readDaySummary } from "../store/memories/chain";
import {
  dayToMonthId,
  dayToYearId,
  isValidMonthId,
} from "../store/memories/chain-time";
import { ensureEngramHome } from "../store/home";
import { config } from "../config";
import { makeDreamRunId } from "../dream/run";
import { runRollupCascade } from "../dream/rollup";
import { MockRollupAgent, pickRollupAgent } from "../agent/rollup";
import { commitDraft } from "../store/dreams/draft";
import { prepareDreamDraft, finalizeDraftFromDisk } from "../store/dreams/file-pipeline";
import { addInitializedIds, type HigherChainLevel } from "../store/memories/chain-higher";

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
  console.log(`backfill under ${config.storeDir} level=${level} until=${until ?? "(none)"}`);

  const dayIds = (await listChainDayIds()).filter((d) => dayIncluded(d, until));
  if (dayIds.length === 0) {
    console.log("no day ids to backfill");
    return;
  }

  const dreamRunId = makeDreamRunId();
  const summaryDayIds = (
    await Promise.all(
      dayIds.map(async (id) => ({ id, summary: await readDaySummary(id) })),
    )
  ).filter(({ summary }) => summary.trim()).map(({ id }) => id);

  const forceLevels: HigherChainLevel[] =
    level === "week" || level === "month" || level === "year"
      ? [level]
      : ["week", "month", "year"];

  await prepareDreamDraft(dreamRunId);

  const agent =
    process.env.ENGRAM_AGENT === "mock-ok" || process.env.ENGRAM_AGENT?.startsWith("mock")
      ? new MockRollupAgent()
      : pickRollupAgent();

  const { written, reports } = await runRollupCascade({
    dreamRunId,
    dayIds: summaryDayIds,
    agent,
    forceLevels,
  });
  await finalizeDraftFromDisk(dreamRunId);

  console.log("reports:", JSON.stringify(reports, null, 2));
  const { committed } = await commitDraft(dreamRunId);
  const byLevel: Record<HigherChainLevel, string[]> = { week: [], month: [], year: [] };
  for (const path of written) {
    const level = path.startsWith("memories/chain/weeks/")
      ? "week"
      : path.startsWith("memories/chain/months/")
        ? "month"
        : path.startsWith("memories/chain/years/")
          ? "year"
          : null;
    const id = path.match(/\/([^/]+)\.summary\.md$/)?.[1];
    if (!level || !id) continue;
    byLevel[level].push(id);
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
