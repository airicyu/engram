/**
 * Ask-history TTL tests (isolated ENGRAM_STORE_DIR via cleanup CLI).
 * Run: cd server && bun test src/store/dreams/ask-history.test.ts
 */

import { describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serverRoot = join(import.meta.dir, "../../..");

async function withStore<T>(fn: (storeDir: string) => Promise<T>): Promise<T> {
  const storeDir = await mkdtemp(join(tmpdir(), "engram-ask-hist-"));
  await mkdir(join(storeDir, "dreams", "ask-history"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "draft"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "runs"), { recursive: true });
  await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
  await writeFile(
    join(storeDir, "engram.workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: en\nstore_version: 0.40.0\n",
    "utf8",
  );
  return fn(storeDir);
}

function runCleanup(storeDir: string, extraEnv: Record<string, string> = {}): Record<string, unknown> {
  const proc = spawnSync("bun", ["run", "src/cli/dreams-cleanup.ts"], {
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

describe("ask history prune", () => {
  test("deletes over-age history json", async () => {
    await withStore(async (storeDir) => {
      const id = "ask-old-001";
      await writeFile(
        join(storeDir, "dreams", "ask-history", `${id}.json`),
        JSON.stringify({
          job_id: id,
          q: "old?",
          status: "completed",
          started_at: "2020-01-01T00:00:00+08:00",
          completed_at: "2020-01-01T00:01:00+08:00",
          answer: "yes",
        }),
        "utf8",
      );
      const result = runCleanup(storeDir, { ENGRAM_ASK_HISTORY_RETENTION_HOURS: "24" });
      expect(result.ask_history_removed).toContain(id);
      expect(await exists(join(storeDir, "dreams", "ask-history", `${id}.json`))).toBe(false);
    });
  });

  test("retention 0 deletes all history files", async () => {
    await withStore(async (storeDir) => {
      const id = "ask-fresh-001";
      await writeFile(
        join(storeDir, "dreams", "ask-history", `${id}.json`),
        JSON.stringify({
          job_id: id,
          q: "now?",
          status: "failed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          answer: null,
        }),
        "utf8",
      );
      const result = runCleanup(storeDir, { ENGRAM_ASK_HISTORY_RETENTION_HOURS: "0" });
      expect(result.ask_history_removed).toContain(id);
      expect(await exists(join(storeDir, "dreams", "ask-history", `${id}.json`))).toBe(false);
    });
  });
});
