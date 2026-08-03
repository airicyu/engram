/**
 * Mechanical rollup candidates + plan enforcement (closed catch-up; never open periods).
 */

import { listChainDayIds, readDaySummary } from "../../store/memories/chain";
import {
  higherSummaryExists,
  type HigherChainLevel,
} from "../../store/memories/chain-higher";
import {
  candidatesFromDayIds,
  daysInWeek,
  dayToMonthId,
  dayToWeekId,
  dayToYearId,
  isCurrentMonth,
  isCurrentWeek,
  isCurrentYear,
  weeksOverlappingMonth,
} from "../../store/memories/chain-time";
import {
  readDaySummaryPreferDraft,
  readHigherSummaryCurrentPreferDraft,
} from "../../store/dreams/draft";

export type CandidateMeta = {
  id: string;
  exists: boolean;
  suggested_operation: "init" | "revise";
  is_current_period: boolean;
};

export type EnforcePlanInput = {
  level: HigherChainLevel;
  execute: boolean;
  targets: Array<{ id: string; operation: "init" | "revise"; reason: string }>;
  reason?: string;
};

function isCurrentPeriod(level: HigherChainLevel, id: string, today: string): boolean {
  if (level === "week") return isCurrentWeek(id, today);
  if (level === "month") return isCurrentMonth(id, today);
  return isCurrentYear(id, today);
}

async function dayHasSummary(dreamRunId: string | undefined, dayId: string): Promise<boolean> {
  if (dreamRunId) {
    const d = await readDaySummaryPreferDraft(dreamRunId, dayId);
    if (d.trim()) return true;
  }
  return !!(await readDaySummary(dayId)).trim();
}

async function weekHasLowerContent(dreamRunId: string | undefined, weekId: string): Promise<boolean> {
  for (const day of daysInWeek(weekId)) {
    if (await dayHasSummary(dreamRunId, day)) return true;
  }
  return false;
}

async function monthHasLowerContent(dreamRunId: string | undefined, monthId: string): Promise<boolean> {
  for (const weekId of weeksOverlappingMonth(monthId)) {
    if (dreamRunId) {
      const w = await readHigherSummaryCurrentPreferDraft(dreamRunId, "week", weekId);
      if (w.trim()) return true;
    }
    if (await higherSummaryExists("week", weekId)) return true;
  }
  const allDays = await listChainDayIds();
  for (const dayId of allDays) {
    if (!dayId.startsWith(monthId)) continue;
    if (await dayHasSummary(dreamRunId, dayId)) return true;
  }
  return false;
}

async function yearHasLowerContent(dreamRunId: string | undefined, yearId: string): Promise<boolean> {
  for (let m = 1; m <= 12; m++) {
    const monthId = `${yearId}-${String(m).padStart(2, "0")}`;
    if (dreamRunId) {
      const cur = await readHigherSummaryCurrentPreferDraft(dreamRunId, "month", monthId);
      if (cur.trim()) return true;
    }
    if (await higherSummaryExists("month", monthId)) return true;
  }
  const allDays = await listChainDayIds();
  for (const dayId of allDays) {
    if (!dayId.startsWith(`${yearId}-`)) continue;
    if (await dayHasSummary(dreamRunId, dayId)) return true;
  }
  return false;
}

/**
 * Candidates for one rollup level:
 * (touched days → periods) ∪ (closed + missing higher + lower content),
 * then drop any still-open current period.
 */
export async function candidatesForRollup(opts: {
  level: HigherChainLevel;
  touchedDayIds: string[];
  today: string;
  dreamRunId?: string;
}): Promise<string[]> {
  const { level, today, dreamRunId } = opts;
  const touched = [...new Set(opts.touchedDayIds)].filter(Boolean).sort();
  const fromTouched = candidatesFromDayIds(touched);
  const set = new Set(
    level === "week" ? fromTouched.weeks : level === "month" ? fromTouched.months : fromTouched.years,
  );

  const allDays = await listChainDayIds();
  for (const dayId of allDays) {
    try {
      if (level === "week") {
        const weekId = dayToWeekId(dayId);
        if (isCurrentWeek(weekId, today)) continue;
        if (await higherSummaryExists("week", weekId)) continue;
        if (await weekHasLowerContent(dreamRunId, weekId)) set.add(weekId);
      } else if (level === "month") {
        const monthId = dayToMonthId(dayId);
        if (isCurrentMonth(monthId, today)) continue;
        if (await higherSummaryExists("month", monthId)) continue;
        if (await monthHasLowerContent(dreamRunId, monthId)) set.add(monthId);
      } else {
        const yearId = dayToYearId(dayId);
        if (isCurrentYear(yearId, today)) continue;
        if (await higherSummaryExists("year", yearId)) continue;
        if (await yearHasLowerContent(dreamRunId, yearId)) set.add(yearId);
      }
    } catch {
      // skip invalid day ids
    }
  }

  return [...set].filter((id) => !isCurrentPeriod(level, id, today)).sort();
}

/** Period ids derived from touched days (may include open periods — caller filters). */
export function touchedPeriodIds(level: HigherChainLevel, touchedDayIds: string[]): Set<string> {
  const c = candidatesFromDayIds(touchedDayIds);
  if (level === "week") return new Set(c.weeks);
  if (level === "month") return new Set(c.months);
  return new Set(c.years);
}

/**
 * After planner returns: strip open periods; force closed+missing init;
 * force revise for closed+exists when touched this dream.
 */
export function enforceRollupPlan(opts: {
  level: HigherChainLevel;
  plan: EnforcePlanInput;
  meta: CandidateMeta[];
  touchedPeriods: Set<string>;
  forceExecute?: boolean;
}): EnforcePlanInput {
  const { level, plan, meta, touchedPeriods, forceExecute } = opts;
  const reasonById = new Map(plan.targets.map((t) => [t.id, t.reason]));

  const targets: EnforcePlanInput["targets"] = [];
  for (const m of meta) {
    if (m.is_current_period) continue;
    if (!m.exists) {
      targets.push({
        id: m.id,
        operation: "init",
        reason: reasonById.get(m.id) ?? "closed period catch-up init",
      });
      continue;
    }
    if (touchedPeriods.has(m.id) || forceExecute) {
      targets.push({
        id: m.id,
        operation: "revise",
        reason: reasonById.get(m.id) ?? (forceExecute ? "backfill force" : "touched closed period revise"),
      });
    }
  }

  if (targets.length === 0) {
    return {
      level,
      execute: false,
      targets: [],
      reason: plan.reason ?? "no closed periods to roll up",
    };
  }
  return { level, execute: true, targets };
}
