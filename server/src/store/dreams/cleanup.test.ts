/**
 * Dream staging cleanup tests (isolated ENGRAM_STORE_DIR via subprocess).
 * Run: cd server && bun test src/store/dreams/cleanup.test.ts
 */

import { describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serverRoot = join(import.meta.dir, "../../..");

async function withStore<T>(fn: (storeDir: string) => Promise<T>): Promise<T> {
  const storeDir = await mkdtemp(join(tmpdir(), "engram-cleanup-"));
  await mkdir(join(storeDir, "dreams", "draft"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "runs"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
  await writeFile(
    join(storeDir, "engram.workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: en\nstore_version: 0.20.0\n",
    "utf8",
  );
  return fn(storeDir);
}

function runCleanup(
  storeDir: string,
  dryRun = false,
  extraEnv: Record<string, string> = {},
): Record<string, unknown> {
  const args = ["run", "src/cli/dreams-cleanup.ts"];
  if (dryRun) args.push("--dry-run");
  const proc = spawnSync("bun", args, {
    cwd: serverRoot,
    env: { ...process.env, ENGRAM_STORE_DIR: storeDir, ...extraEnv },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `cleanup exit ${proc.status}`);
  }
  const line = proc.stdout.trim().split("\n").find((l) => l.startsWith("{"));
  if (!line) throw new Error(`no json in stdout: ${proc.stdout}`);
  return JSON.parse(line) as Record<string, unknown>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("dream staging cleanup", () => {
  test("removes orphan draft directories", async () => {
    await withStore(async (storeDir) => {
      const orphan = join(storeDir, "dreams", "draft", "dream-orphan-001");
      await mkdir(orphan, { recursive: true });
      await writeFile(join(orphan, "manifest.yaml"), "entries: []\n", "utf8");

      const result = runCleanup(storeDir);
      expect(result.orphan_drafts_removed).toEqual(["dream-orphan-001"]);
      expect(await exists(orphan)).toBe(false);
    });
  });

  test("dry-run keeps orphan draft on disk", async () => {
    await withStore(async (storeDir) => {
      const orphan = join(storeDir, "dreams", "draft", "dream-orphan-dry");
      await mkdir(orphan, { recursive: true });

      const result = runCleanup(storeDir, true);
      expect(result.dry_run).toBe(true);
      expect(result.orphan_drafts_removed).toEqual(["dream-orphan-dry"]);
      expect(await exists(orphan)).toBe(true);
    });
  });

  test("keeps draft for pending run", async () => {
    await withStore(async (storeDir) => {
      const pendingId = "dream-pending-keep";
      await writeFile(
        join(storeDir, "dreams", "runs", `${pendingId}.yaml`),
        `id: ${pendingId}\nstatus: pending\nscope: []\ncreated_at: 2026-01-01T00:00:00+08:00\npatch_count: 0\nreport_path: dreams/reports/${pendingId}.md\n`,
        "utf8",
      );
      const draft = join(storeDir, "dreams", "draft", pendingId);
      await mkdir(draft, { recursive: true });

      const result = runCleanup(storeDir);
      expect(result.orphan_drafts_removed).toEqual([]);
      expect(await exists(draft)).toBe(true);
    });
  });

  test("recovers stale running dream-job on startup sweep", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-crash-001";
      await writeFile(
        join(storeDir, "dreams", "dream-job.yaml"),
        `status: running\ndream_run_id: ${runId}\nstarted_at: 2026-01-01T00:00:00+08:00\nphase: extract\nagent_pid: 999999\nlock_token: dead-token\n`,
        "utf8",
      );
      const draft = join(storeDir, "dreams", "draft", runId);
      await mkdir(draft, { recursive: true });

      const result = runCleanup(storeDir);
      expect(result.stale_job_recovered).toBe(true);
      expect(await exists(draft)).toBe(false);

      const jobRaw = await Bun.file(join(storeDir, "dreams", "dream-job.yaml")).text();
      expect(jobRaw).toContain("status: failed");
      expect(jobRaw).toContain("recovered after server restart");
    });
  });

  test("TTL removes old discarded report and run yaml", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-discard-old";
      await writeFile(
        join(storeDir, "dreams", "runs", `${runId}.yaml`),
        `id: ${runId}\nstatus: discarded\nscope: []\ncreated_at: 2020-01-01T00:00:00+08:00\npatch_count: 0\nreport_path: dreams/reports/${runId}.md\n`,
        "utf8",
      );
      await writeFile(join(storeDir, "dreams", "reports", `${runId}.md`), "# old\n", "utf8");

      const result = runCleanup(storeDir, false, {
        ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS: "0",
        ENGRAM_DREAM_STAGING_RETENTION_DAYS: "3",
      });
      expect(result.reports_removed).toContain(runId);
      expect(result.run_yamls_removed).toContain(runId);
      expect(await exists(join(storeDir, "dreams", "reports", `${runId}.md`))).toBe(false);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.yaml`))).toBe(false);
    });
  });

  test("committed report kept when retention is -1", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-commit-keep";
      await writeFile(
        join(storeDir, "dreams", "runs", `${runId}.yaml`),
        `id: ${runId}\nstatus: committed\nscope: []\ncreated_at: 2020-01-01T00:00:00+08:00\ncommitted_at: 2020-01-02T00:00:00+08:00\npatch_count: 1\nreport_path: dreams/reports/${runId}.md\n`,
        "utf8",
      );
      await writeFile(join(storeDir, "dreams", "reports", `${runId}.md`), "# keep\n", "utf8");

      const result = runCleanup(storeDir, false, {
        ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS: "0",
        ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS: "-1",
      });
      expect(result.reports_removed).not.toContain(runId);
      expect(result.run_yamls_removed ?? []).not.toContain(runId);
      expect(await exists(join(storeDir, "dreams", "reports", `${runId}.md`))).toBe(true);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.yaml`))).toBe(true);
    });
  });

  test("TTL removes committed report yaml and input together", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-commit-old";
      await writeFile(
        join(storeDir, "dreams", "runs", `${runId}.yaml`),
        `id: ${runId}\nstatus: committed\nscope: []\ncreated_at: 2020-01-01T00:00:00+08:00\ncommitted_at: 2020-01-02T00:00:00+08:00\npatch_count: 1\nreport_path: dreams/reports/${runId}.md\n`,
        "utf8",
      );
      await writeFile(join(storeDir, "dreams", "runs", `${runId}.input.json`), "{}\n", "utf8");
      await writeFile(join(storeDir, "dreams", "reports", `${runId}.md`), "# old\n", "utf8");
      await mkdir(join(storeDir, "dreams", "runs", runId), { recursive: true });
      await writeFile(join(storeDir, "dreams", "runs", runId, "events.jsonl"), "{}\n", "utf8");

      const result = runCleanup(storeDir, false, {
        ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS: "0",
        ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS: "7",
      });
      expect(result.reports_removed).toContain(runId);
      expect(result.event_dirs_removed).toContain(runId);
      expect(result.run_yamls_removed).toContain(runId);
      expect(result.input_jsons_removed).toContain(runId);
      expect(await exists(join(storeDir, "dreams", "reports", `${runId}.md`))).toBe(false);
      expect(await exists(join(storeDir, "dreams", "runs", runId))).toBe(false);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.yaml`))).toBe(false);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.input.json`))).toBe(false);
    });
  });

  test("TTL keeps pending yaml report and input", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-pending-old";
      await writeFile(
        join(storeDir, "dreams", "runs", `${runId}.yaml`),
        `id: ${runId}\nstatus: pending\nscope: []\ncreated_at: 2020-01-01T00:00:00+08:00\npatch_count: 0\nreport_path: dreams/reports/${runId}.md\n`,
        "utf8",
      );
      await writeFile(join(storeDir, "dreams", "runs", `${runId}.input.json`), "{}\n", "utf8");
      await writeFile(join(storeDir, "dreams", "reports", `${runId}.md`), "# pending\n", "utf8");

      const result = runCleanup(storeDir, false, {
        ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS: "0",
        ENGRAM_DREAM_STAGING_RETENTION_DAYS: "3",
        ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS: "7",
      });
      expect(result.reports_removed ?? []).not.toContain(runId);
      expect(result.run_yamls_removed ?? []).not.toContain(runId);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.yaml`))).toBe(true);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.input.json`))).toBe(true);
      expect(await exists(join(storeDir, "dreams", "reports", `${runId}.md`))).toBe(true);
    });
  });

  test("TTL keeps l1_clear_pending yaml", async () => {
    await withStore(async (storeDir) => {
      const runId = "dream-l1-pending";
      await writeFile(
        join(storeDir, "dreams", "runs", `${runId}.yaml`),
        `id: ${runId}\nstatus: committed\nl1_clear_pending: true\nscope: []\ncreated_at: 2020-01-01T00:00:00+08:00\ncommitted_at: 2020-01-02T00:00:00+08:00\npatch_count: 1\nreport_path: dreams/reports/${runId}.md\n`,
        "utf8",
      );
      await writeFile(join(storeDir, "dreams", "runs", `${runId}.input.json`), "{}\n", "utf8");
      await writeFile(join(storeDir, "dreams", "reports", `${runId}.md`), "# keep\n", "utf8");

      const result = runCleanup(storeDir, false, {
        ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS: "0",
        ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS: "7",
      });
      expect(result.run_yamls_removed ?? []).not.toContain(runId);
      expect(await exists(join(storeDir, "dreams", "runs", `${runId}.yaml`))).toBe(true);
      expect(await exists(join(storeDir, "dreams", "reports", `${runId}.md`))).toBe(true);
    });
  });
});
