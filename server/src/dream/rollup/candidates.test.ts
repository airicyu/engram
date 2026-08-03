/**
 * Rollup candidates + enforce plan (closed catch-up; never open periods).
 * Run: cd server && bun test src/dream/rollup/candidates.test.ts src/dream/rollup/cascade.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enforceRollupPlan } from "./candidates";
import { dayToWeekId } from "../../store/memories/chain-time";

const serverRoot = join(import.meta.dir, "../../..");

async function writeDaySummary(storeDir: string, dayId: string, body = "summary"): Promise<void> {
  const ym = dayId.slice(0, 7);
  const dir = join(storeDir, "memories", "chain", "days", ym);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${dayId}.summary.md`), `## Current\n\n${body}\n`, "utf8");
  await writeFile(join(dir, `${dayId}.md`), `- ${body}\n`, "utf8");
}

async function writeWorkspace(storeDir: string): Promise<void> {
  await writeFile(
    join(storeDir, "engram.workspace.yaml"),
    "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n",
    "utf8",
  );
}

function loadCandidates(
  storeDir: string,
  args: { level: string; touched: string[]; today: string },
): string[] {
  const script = `
    import { candidatesForRollup } from "./src/dream/rollup/candidates.ts";
    const ids = await candidatesForRollup({
      level: ${JSON.stringify(args.level)},
      touchedDayIds: ${JSON.stringify(args.touched)},
      today: ${JSON.stringify(args.today)},
    });
    console.log(JSON.stringify(ids));
  `;
  const proc = spawnSync("bun", ["-e", script], {
    cwd: serverRoot,
    env: { ...process.env, ENGRAM_STORE_DIR: storeDir, ENGRAM_TZ: "Asia/Hong_Kong" },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
  }
  return JSON.parse(proc.stdout.trim()) as string[];
}

describe("enforceRollupPlan", () => {
  test("forces closed missing init even when planner skips", () => {
    const plan = enforceRollupPlan({
      level: "week",
      plan: { level: "week", execute: false, targets: [], reason: "skip all" },
      meta: [
        {
          id: "2026-W31-0727",
          exists: false,
          suggested_operation: "init",
          is_current_period: false,
        },
        {
          id: "2026-W32-0803",
          exists: false,
          suggested_operation: "init",
          is_current_period: true,
        },
      ],
      touchedPeriods: new Set(["2026-W32-0803"]),
    });
    expect(plan.execute).toBe(true);
    expect(plan.targets.map((t) => t.id)).toEqual(["2026-W31-0727"]);
    expect(plan.targets[0]!.operation).toBe("init");
  });

  test("strips open period from planner targets", () => {
    const plan = enforceRollupPlan({
      level: "week",
      plan: {
        level: "week",
        execute: true,
        targets: [
          { id: "2026-W31-0727", operation: "init", reason: "catch-up" },
          { id: "2026-W32-0803", operation: "init", reason: "also current" },
        ],
      },
      meta: [
        {
          id: "2026-W31-0727",
          exists: false,
          suggested_operation: "init",
          is_current_period: false,
        },
        {
          id: "2026-W32-0803",
          exists: false,
          suggested_operation: "init",
          is_current_period: true,
        },
      ],
      touchedPeriods: new Set(["2026-W32-0803"]),
    });
    expect(plan.targets.map((t) => t.id)).toEqual(["2026-W31-0727"]);
  });

  test("revises closed existing when touched", () => {
    const plan = enforceRollupPlan({
      level: "week",
      plan: { level: "week", execute: false, targets: [] },
      meta: [
        {
          id: "2026-W30-0720",
          exists: true,
          suggested_operation: "revise",
          is_current_period: false,
        },
      ],
      touchedPeriods: new Set(["2026-W30-0720"]),
    });
    expect(plan.execute).toBe(true);
    expect(plan.targets).toEqual([
      {
        id: "2026-W30-0720",
        operation: "revise",
        reason: "touched closed period revise",
      },
    ]);
  });
});

describe("candidatesForRollup", () => {
  test("Sunday touched: current week excluded", async () => {
    // 2026-08-02 is Sunday of W31; today still 2026-08-02 → W31 is current
    const storeDir = await mkdtemp(join(tmpdir(), "engram-cand-sun-"));
    await writeWorkspace(storeDir);
    await writeDaySummary(storeDir, "2026-08-02");
    const weeks = loadCandidates(storeDir, {
      level: "week",
      touched: ["2026-08-02"],
      today: "2026-08-02",
    });
    expect(weeks).not.toContain("2026-W31-0727");
    expect(weeks).toEqual([]);
  });

  test("Monday touched: includes previous closed week, excludes current", async () => {
    // 2026-08-03 Monday = W32; W31 closed; day on 08-01 in W31
    const storeDir = await mkdtemp(join(tmpdir(), "engram-cand-mon-"));
    await writeWorkspace(storeDir);
    await writeDaySummary(storeDir, "2026-08-01");
    await writeDaySummary(storeDir, "2026-08-03");
    const weeks = loadCandidates(storeDir, {
      level: "week",
      touched: ["2026-08-03"],
      today: "2026-08-03",
    });
    expect(weeks).toContain("2026-W31-0727");
    expect(weeks).not.toContain("2026-W32-0803");
  });

  test("multi-week gap: all closed missing weeks with days are candidates", async () => {
    // today 2026-08-04 (W32); seed W29/W30/W31 days, no week files
    const storeDir = await mkdtemp(join(tmpdir(), "engram-cand-gap-"));
    await writeWorkspace(storeDir);
    await writeDaySummary(storeDir, "2026-07-14"); // W29-0713
    await writeDaySummary(storeDir, "2026-07-21"); // W30-0720
    await writeDaySummary(storeDir, "2026-08-01"); // W31-0727
    const w29 = dayToWeekId("2026-07-14");
    const w30 = dayToWeekId("2026-07-21");
    const w31 = dayToWeekId("2026-08-01");
    const weeks = loadCandidates(storeDir, {
      level: "week",
      touched: ["2026-08-04"],
      today: "2026-08-04",
    });
    expect(weeks).toContain(w29);
    expect(weeks).toContain(w30);
    expect(weeks).toContain(w31);
    expect(weeks).not.toContain(dayToWeekId("2026-08-04"));
  });

  test("August dream: July month catch-up, not current August", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-cand-mo-"));
    await writeWorkspace(storeDir);
    await writeDaySummary(storeDir, "2026-07-15");
    await writeDaySummary(storeDir, "2026-08-04");
    const months = loadCandidates(storeDir, {
      level: "month",
      touched: ["2026-08-04"],
      today: "2026-08-04",
    });
    expect(months).toContain("2026-07");
    expect(months).not.toContain("2026-08");
  });

  test("January dream: prior year catch-up, not current year", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-cand-yr-"));
    await writeWorkspace(storeDir);
    await writeDaySummary(storeDir, "2025-12-20");
    await writeDaySummary(storeDir, "2026-01-05");
    const years = loadCandidates(storeDir, {
      level: "year",
      touched: ["2026-01-05"],
      today: "2026-01-05",
    });
    expect(years).toContain("2025");
    expect(years).not.toContain("2026");
  });
});
