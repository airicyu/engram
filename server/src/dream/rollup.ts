/** Post-extract week／month／year rollup: planner → writer → draft file updates. */

import { readDay, readDaySummary } from "../store/memories/chain";
import {
  higherSummaryExists,
  higherSummaryRel,
  resolveHigherOperation,
  type HigherChainLevel,
} from "../store/memories/chain-higher";
import {
  candidatesFromDayIds,
  daysInWeek,
  isCurrentMonth,
  isCurrentWeek,
  isCurrentYear,
  weeksOverlappingMonth,
} from "../store/memories/chain-time";
import {
  readDaySummaryPreferDraft,
  readHigherSummaryCurrentPreferDraft,
} from "../store/dreams/draft";
import { writeDraftMemoryFile } from "../store/dreams/file-pipeline";
import { calendarDate, nowIso } from "../store/memories/activities";
import { config } from "../config";
import { emitDreamEvent } from "./emit-event";
import { throwIfDreamCancelled } from "./cancel-state";
import { assertFusedRollupSummary } from "./rollup-quality";

export interface RollupPlanTarget {
  id: string;
  operation: "init" | "revise";
  reason: string;
}

export interface RollupPlan {
  level: HigherChainLevel;
  execute: boolean;
  targets: RollupPlanTarget[];
  /** Planner free-text when execute=false. */
  reason?: string;
}

export interface RollupPlanContext {
  dream_run_id: string;
  level: HigherChainLevel;
  timezone: string;
  memory_language: string;
  now: string;
  today: string;
  candidates: string[];
  /** Mechanical flags for each candidate. */
  candidate_meta: Array<{
    id: string;
    exists: boolean;
    suggested_operation: "init" | "revise";
    is_current_period: boolean;
  }>;
}

export interface RollupWriteContext {
  dream_run_id: string;
  level: HigherChainLevel;
  id: string;
  operation: "init" | "revise";
  timezone: string;
  memory_language: string;
  now: string;
  today: string;
  /** Lower-layer Current texts (prefer draft). */
  lower: Array<{ id: string; current: string; missing?: boolean }>;
  prior_current: string;
}

export interface RollupAgent {
  plan(ctx: RollupPlanContext): Promise<RollupPlan>;
  write(ctx: RollupWriteContext): Promise<string>;
}

export interface RollupLevelReport {
  level: HigherChainLevel;
  execute: boolean;
  reason?: string;
  targets: Array<{ id: string; operation: "init" | "revise"; reason: string }>;
}

function dayIdsFromList(dayIds: string[]): string[] {
  return [...new Set(dayIds)].sort();
}

async function buildPlanContext(
  dreamRunId: string,
  level: HigherChainLevel,
  candidates: string[],
  today: string,
): Promise<RollupPlanContext> {
  const candidate_meta = [];
  for (const id of candidates) {
    const exists = await higherSummaryExists(level, id);
    const suggested_operation = await resolveHigherOperation(level, id);
    let is_current_period = false;
    if (level === "week") is_current_period = isCurrentWeek(id, today);
    else if (level === "month") is_current_period = isCurrentMonth(id, today);
    else is_current_period = isCurrentYear(id, today);
    candidate_meta.push({ id, exists, suggested_operation, is_current_period });
  }
  return {
    dream_run_id: dreamRunId,
    level,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    now: nowIso(),
    today,
    candidates,
    candidate_meta,
  };
}

async function assembleLowerContext(
  dreamRunId: string,
  level: HigherChainLevel,
  id: string,
): Promise<Array<{ id: string; current: string; missing?: boolean }>> {
  if (level === "week") {
    const out = [];
    for (const day of daysInWeek(id)) {
      const fromDraft = await readDaySummaryPreferDraft(dreamRunId, day);
      if (fromDraft.trim()) {
        out.push({ id: day, current: fromDraft });
        continue;
      }
      const live = await readDaySummary(day);
      if (live.trim()) {
        out.push({ id: day, current: live });
        continue;
      }
      const ledger = await readDay(day);
      if (ledger.trim()) {
        out.push({ id: day, current: ledger });
      } else {
        out.push({ id: day, current: "", missing: true });
      }
    }
    return out.filter((x) => !x.missing || x.current);
  }

  if (level === "month") {
    const out = [];
    for (const weekId of weeksOverlappingMonth(id)) {
      const current = await readHigherSummaryCurrentPreferDraft(dreamRunId, "week", weekId);
      if (current.trim()) {
        out.push({ id: weekId, current });
        continue;
      }
      // Fallback: day summaries for days in that week that fall in this month
      const monthPrefix = id;
      const dayBits: string[] = [];
      for (const day of daysInWeek(weekId)) {
        if (!day.startsWith(monthPrefix)) continue;
        const d =
          (await readDaySummaryPreferDraft(dreamRunId, day)) || (await readDaySummary(day));
        if (d.trim()) dayBits.push(`${day}: ${d.trim()}`);
      }
      if (dayBits.length) {
        out.push({ id: weekId, current: dayBits.join("\n") });
      } else {
        out.push({ id: weekId, current: "", missing: true });
      }
    }
    return out.filter((x) => x.current.trim() || !x.missing);
  }

  // year ← months
  const year = id;
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const monthId = `${year}-${String(m).padStart(2, "0")}`;
    const current = await readHigherSummaryCurrentPreferDraft(dreamRunId, "month", monthId);
    if (current.trim()) {
      out.push({ id: monthId, current });
    } else {
      out.push({ id: monthId, current: "", missing: true });
    }
  }
  return out.filter((x) => x.current.trim());
}

function validatePlan(
  plan: RollupPlan,
  level: HigherChainLevel,
  candidates: string[],
  meta: RollupPlanContext["candidate_meta"],
): void {
  if (plan.level !== level) {
    throw new Error(`planner level mismatch: expected ${level}, got ${plan.level}`);
  }
  if (!plan.execute) return;
  const cand = new Set(candidates);
  const metaById = new Map(meta.map((m) => [m.id, m]));
  for (const t of plan.targets) {
    if (!cand.has(t.id)) {
      throw new Error(`planner invented non-candidate id: ${t.id}`);
    }
    if (t.operation !== "init" && t.operation !== "revise") {
      throw new Error(`invalid operation for ${t.id}`);
    }
    const expected = metaById.get(t.id)?.suggested_operation;
    if (expected && t.operation !== expected) {
      throw new Error(
        `operation mismatch for ${t.id}: planner=${t.operation} disk=${expected}`,
      );
    }
  }
}

async function runLevel(opts: {
  dreamRunId: string;
  level: HigherChainLevel;
  candidates: string[];
  agent: RollupAgent;
  today: string;
  forceExecute?: boolean;
}): Promise<{ written: string[]; report: RollupLevelReport }> {
  const { dreamRunId, level, candidates, agent, today, forceExecute } = opts;
  const planCtx = await buildPlanContext(dreamRunId, level, candidates, today);
  let plan = await agent.plan(planCtx);
  if (forceExecute && candidates.length > 0) {
    plan = {
      level,
      execute: true,
      targets: planCtx.candidate_meta.map((m) => ({
        id: m.id,
        operation: m.suggested_operation,
        reason: plan.targets.find((t) => t.id === m.id)?.reason ?? "backfill force",
      })),
    };
  }
  validatePlan(plan, level, candidates, planCtx.candidate_meta);

  const report: RollupLevelReport = {
    level,
    execute: plan.execute,
    reason: plan.reason,
    targets: plan.execute ? plan.targets : [],
  };

  if (!plan.execute || plan.targets.length === 0) {
    return { written: [], report };
  }

  const written: string[] = [];
  const ts = nowIso();
  for (const t of plan.targets) {
    throwIfDreamCancelled(dreamRunId);
    const lower = await assembleLowerContext(dreamRunId, level, t.id);
    const prior_current = await readHigherSummaryCurrentPreferDraft(dreamRunId, level, t.id);
    const summary = await agent.write({
      dream_run_id: dreamRunId,
      level,
      id: t.id,
      operation: t.operation,
      timezone: config.timezone,
      memory_language: config.memoryLanguage,
      now: ts,
      today,
      lower,
      prior_current,
    });
    assertFusedRollupSummary(level, summary);
    const rel = higherSummaryRel(level, t.id);
    await writeDraftMemoryFile(dreamRunId, rel, summary.trim());
    written.push(rel);
  }
  return { written, report };
}

/**
 * After day draft files exist: cascade week → month → year into the same draft.
 */
export async function runRollupCascade(opts: {
  dreamRunId: string;
  dayIds: string[];
  agent: RollupAgent;
  forceLevels?: HigherChainLevel[];
}): Promise<{ written: string[]; reports: RollupLevelReport[] }> {
  const { dreamRunId, agent } = opts;
  const today = calendarDate();
  const dayIds = dayIdsFromList(opts.dayIds);
  const candidates = candidatesFromDayIds(dayIds);
  const allWritten: string[] = [];
  const reports: RollupLevelReport[] = [];

  const levels: HigherChainLevel[] = ["week", "month", "year"];
  for (const level of levels) {
    throwIfDreamCancelled(dreamRunId);
    const cand =
      level === "week"
        ? candidates.weeks
        : level === "month"
          ? candidates.months
          : candidates.years;

    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "rollup_plan_start",
      message: `Rollup planner ${level} (${cand.length} candidates)`,
      detail: { level, candidates: cand },
    });

    const forceExecute = opts.forceLevels?.includes(level);
    const { written, report } = await runLevel({
      dreamRunId,
      level,
      candidates: cand,
      agent,
      today,
      forceExecute,
    });
    reports.push(report);

    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "rollup_plan_done",
      message: planMessage(report),
      detail: report,
    });

    allWritten.push(...written);
  }

  return { written: allWritten, reports };
}

function planMessage(report: RollupLevelReport): string {
  if (!report.execute) return `${report.level}: skip (${report.reason ?? "N"})`;
  const ids = report.targets.map((t) => `${t.id}/${t.operation}`).join(", ");
  return `${report.level}: execute [${ids}]`;
}

/** Markdown section for dream report. */
export function formatRollupReportSection(reports: RollupLevelReport[]): string {
  const lines: string[] = [];
  lines.push("## Higher chain rollup (week／month／year)");
  lines.push("");
  if (reports.length === 0) {
    lines.push("_No rollup ran._");
    lines.push("");
    return lines.join("\n");
  }
  for (const r of reports) {
    lines.push(`### ${r.level}`);
    if (!r.execute) {
      lines.push(`- execute: **N**${r.reason ? ` — ${r.reason}` : ""}`);
    } else if (r.targets.length === 0) {
      lines.push("- execute: **Y** but no targets");
    } else {
      lines.push("- execute: **Y**");
      for (const t of r.targets) {
        lines.push(`  - \`${t.id}\` **${t.operation}** — ${t.reason}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
