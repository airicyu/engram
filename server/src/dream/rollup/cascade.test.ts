/**
 * Rollup cascade integration (mock agent + enforce).
 * Run: cd server && bun test src/dream/rollup/cascade.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serverRoot = join(import.meta.dir, "../../..");

async function seedStore(base: string): Promise<void> {
  const dayDir = join(base, "memories", "chain", "days", "2026-08");
  await mkdir(dayDir, { recursive: true });
  await writeFile(
    join(dayDir, "2026-08-01.summary.md"),
    "## Current\n\nAug 1 summary.\n",
    "utf8",
  );
  await writeFile(join(dayDir, "2026-08-01.md"), "- event\n", "utf8");
  await writeFile(
    join(base, "engram.workspace.yaml"),
    "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n",
    "utf8",
  );
  await mkdir(join(base, "tmp"), { recursive: true });
  await writeFile(
    join(base, "tmp", "clock.json"),
    JSON.stringify({ now: "2026-08-04T12:00:00+08:00" }),
    "utf8",
  );
}

function runCascade(storeDir: string, dayIds: string[]): {
  weekTargets: string[];
  weekExecute: boolean;
} {
  const script = `
    import { loadClockFromDisk } from "./src/store/clock.ts";
    import { runRollupCascade } from "./src/dream/rollup/cascade.ts";
    import { prepareDreamDraft } from "./src/store/dreams/file-pipeline.ts";
    import { MockRollupAgent } from "./src/agent/rollup/mock.ts";
    await loadClockFromDisk();
    const dreamRunId = "dream-test-rollup";
    await prepareDreamDraft(dreamRunId);
    const { reports } = await runRollupCascade({
      dreamRunId,
      dayIds: ${JSON.stringify(dayIds)},
      agent: new MockRollupAgent(),
    });
    const week = reports.find((r) => r.level === "week");
    console.log(JSON.stringify({
      weekExecute: !!week?.execute,
      weekTargets: (week?.targets ?? []).map((t) => t.id),
    }));
  `;
  const proc = spawnSync("bun", ["-e", script], {
    cwd: serverRoot,
    env: {
      ...process.env,
      ENGRAM_STORE_DIR: storeDir,
      ENGRAM_TZ: "Asia/Hong_Kong",
      ENGRAM_AGENT: "mock-ok",
    },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
  }
  const line = proc.stdout.trim().split("\n").find((l) => l.startsWith("{"));
  if (!line) throw new Error(`no json: ${proc.stdout}`);
  return JSON.parse(line) as { weekTargets: string[]; weekExecute: boolean };
}

describe("runRollupCascade catch-up", () => {
  test("includes closed week missing summary; never current week", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-rollup-"));
    await seedStore(storeDir);
    const result = runCascade(storeDir, ["2026-08-04"]);
    expect(result.weekExecute).toBe(true);
    expect(result.weekTargets).toContain("2026-W31-0727");
    expect(result.weekTargets).not.toContain("2026-W32-0803");
  });

  test("cascade does not call agent.plan; still writes closed catch-up", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-rollup-bad-"));
    await seedStore(storeDir);
    const script = `
      import { loadClockFromDisk } from "./src/store/clock.ts";
      import { runRollupCascade } from "./src/dream/rollup/cascade.ts";
      import { prepareDreamDraft } from "./src/store/dreams/file-pipeline.ts";
      import { MockRollupAgent } from "./src/agent/rollup/mock.ts";
      await loadClockFromDisk();
      class SpyAgent extends MockRollupAgent {
        planCalls = 0;
        async plan(ctx) {
          this.planCalls += 1;
          return super.plan(ctx);
        }
      }
      const dreamRunId = "dream-test-no-plan";
      await prepareDreamDraft(dreamRunId);
      const agent = new SpyAgent();
      const { reports } = await runRollupCascade({
        dreamRunId,
        dayIds: ["2026-08-04"],
        agent,
      });
      const week = reports.find((r) => r.level === "week");
      console.log(JSON.stringify({
        planCalls: agent.planCalls,
        weekTargets: (week?.targets ?? []).map((t) => t.id),
        weekReason: week?.reason ?? null,
      }));
    `;
    const proc = spawnSync("bun", ["-e", script], {
      cwd: serverRoot,
      env: {
        ...process.env,
        ENGRAM_STORE_DIR: storeDir,
        ENGRAM_TZ: "Asia/Hong_Kong",
        ENGRAM_AGENT: "mock-ok",
      },
      encoding: "utf8",
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
    }
    const line = proc.stdout.trim().split("\n").find((l) => l.startsWith("{"));
    if (!line) throw new Error(`no json: ${proc.stdout}`);
    const result = JSON.parse(line) as {
      weekTargets: string[];
      planCalls: number;
      weekReason?: string | null;
    };
    expect(result.planCalls).toBe(0);
    expect(result.weekTargets).not.toContain("2026-W32-0803");
    expect(result.weekTargets).toContain("2026-W31-0727");
    expect(JSON.stringify(result)).not.toContain("mechanical");
  });
});
