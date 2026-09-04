/**
 * Committed dream report list/get (isolated ENGRAM_STORE_DIR via subprocess).
 * Run: cd server && bun test src/api/dream/reports.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serverRoot = join(import.meta.dir, "../../..");

async function withStore<T>(fn: (storeDir: string) => Promise<T>): Promise<T> {
  const storeDir = await mkdtemp(join(tmpdir(), "engram-reports-"));
  await mkdir(join(storeDir, "dreams", "runs"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
  await writeFile(
    join(storeDir, "engram.workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: en\nstore_version: 0.40.0\n",
    "utf8",
  );
  return fn(storeDir);
}

function runScript(storeDir: string, script: string): unknown {
  const proc = spawnSync("bun", ["-e", script], {
    cwd: serverRoot,
    env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
  }
  const line = proc.stdout.trim().split("\n").find((l) => l.startsWith("{") || l.startsWith("["));
  if (!line) throw new Error(`no json in stdout: ${proc.stdout}`);
  return JSON.parse(line);
}

const SAMPLE_REPORT = `# Dream report

## Scope

days: [2026-08-01]

## Events covered

- e1

## Narrative

### Timeline

First beat of the story.

### Long-term updates

_None_

## Node score involvements

_None_

## Appendix — pending deploy

### Paths

- memories/nodes/acme/acme.md
`;

describe("GET /dreams/reports helpers", () => {
  test("lists only committed runs that still have a report file", async () => {
    await withStore(async (storeDir) => {
      const script = `
        import { writeDreamRun, writeReport } from "./src/store/dreams/dream-runs.ts";
        import { listCommittedReports, handleDreamReportGet } from "./src/api/dream/reports.ts";

        await writeDreamRun({
          id: "dream-ok-1",
          status: "committed",
          scope: [],
          created_at: "2026-08-01T10:00:00+08:00",
          committed_at: "2026-08-01T11:00:00+08:00",
          patch_count: 2,
          report_path: "dreams/reports/dream-ok-1.md",
        });
        await writeReport("dream-ok-1", ${JSON.stringify(SAMPLE_REPORT)});

        await writeDreamRun({
          id: "dream-l1",
          status: "committed",
          scope: [],
          created_at: "2026-08-01T09:00:00+08:00",
          committed_at: "2026-08-01T12:00:00+08:00",
          l1_clear_pending: true,
          patch_count: 1,
          report_path: "dreams/reports/dream-l1.md",
        });
        await writeReport("dream-l1", ${JSON.stringify(SAMPLE_REPORT)});

        await writeDreamRun({
          id: "dream-discarded",
          status: "discarded",
          scope: [],
          created_at: "2026-08-01T08:00:00+08:00",
          patch_count: 1,
          report_path: "dreams/reports/dream-discarded.md",
        });
        await writeReport("dream-discarded", ${JSON.stringify(SAMPLE_REPORT)});

        await writeDreamRun({
          id: "dream-pending",
          status: "pending",
          scope: [],
          created_at: "2026-08-01T13:00:00+08:00",
          patch_count: 1,
          report_path: "dreams/reports/dream-pending.md",
        });
        await writeReport("dream-pending", ${JSON.stringify(SAMPLE_REPORT)});

        await writeDreamRun({
          id: "dream-no-md",
          status: "committed",
          scope: [],
          created_at: "2026-08-01T07:00:00+08:00",
          committed_at: "2026-08-01T07:30:00+08:00",
          patch_count: 0,
          report_path: "dreams/reports/dream-no-md.md",
        });

        const items = await listCommittedReports();
        const missing = await handleDreamReportGet("dream-no-md");
        const discardedGet = await handleDreamReportGet("dream-discarded");
        const okGet = await handleDreamReportGet("dream-ok-1");
        const slash = await handleDreamReportGet("../x");
        const empty = await listCommittedReports();
        console.log(JSON.stringify({
          ids: items.map((i) => i.dream_run_id),
          previews: items.map((i) => i.narrative_preview),
          l1: items.find((i) => i.dream_run_id === "dream-l1")?.l1_clear_pending,
          hasFullReport: items.some((i) => "report" in i),
          missing: await missing.json(),
          discardedGet: await discardedGet.json(),
          okPresent: (await okGet.json()).present,
          slashStatus: slash.status,
        }));
      `;
      const out = runScript(storeDir, script) as {
        ids: string[];
        previews: Array<string | null>;
        l1: boolean;
        hasFullReport: boolean;
        missing: { present: boolean };
        discardedGet: { present: boolean };
        okPresent: boolean;
        slashStatus: number;
      };
      expect(out.ids).toEqual(["dream-l1", "dream-ok-1"]);
      expect(out.l1).toBe(true);
      expect(out.hasFullReport).toBe(false);
      expect(out.previews[0]).toContain("First beat");
      expect(out.previews.every((p) => p && !p.includes("Appendix"))).toBe(true);
      expect(out.missing).toEqual({ present: false });
      expect(out.discardedGet).toEqual({ present: false });
      expect(out.okPresent).toBe(true);
      expect(out.slashStatus).toBe(400);
    });
  });

  test("empty list is items []", async () => {
    await withStore(async (storeDir) => {
      const out = runScript(
        storeDir,
        `
        import { listCommittedReports } from "./src/api/dream/reports.ts";
        const items = await listCommittedReports();
        console.log(JSON.stringify({ items }));
        `,
      ) as { items: unknown[] };
      expect(out.items).toEqual([]);
    });
  });
});
