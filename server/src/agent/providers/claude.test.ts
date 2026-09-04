/**
 * Claude argv: generate omits store --add-dir.
 * Run: cd server && bun test src/agent/providers/claude.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaudeCmd } from "./claude";
import { dreamWritePolicy, rollupWritePolicy } from "../shared/write-policy";
import type { DreamContext } from "../dream/types";
import type { AgentJob } from "../flow/types";

function fakeDreamCtx(storeDir: string, runId: string): DreamContext {
  return {
    dream_run_id: runId,
    timezone: "Asia/Hong_Kong",
    memory_language: "en",
    now: "2026-08-02T12:00:00+08:00",
    today: "2026-08-02",
    scope: ["e0000000001"],
    l1: { summary: "test" },
    events: [{ id: "e0000000001", ts: "2026-08-02T12:00:00+08:00", raw: "hello" }],
    l2_current: [],
    existing_nodes: ["acme"],
    chain_summaries_current: [],
    store_dir: storeDir,
    draft_dir: join(storeDir, "dreams", "draft", runId),
    report_path: join(storeDir, "dreams", "reports", `${runId}.md`),
  };
}

describe("buildClaudeCmd", () => {
  test("extract job includes store --add-dir", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-claude-ex-"));
    const ctx = fakeDreamCtx(storeDir, "dream-1");
    await mkdir(ctx.draft_dir, { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    const workDir = await mkdtemp(join(tmpdir(), "engram-claude-work-"));
    const policy = dreamWritePolicy(ctx, [workDir]);
    const job: AgentJob = {
      processKey: "dream:dream-1",
      prompt: "extract",
      cwd: workDir,
      writePolicy: policy,
    };
    const cmd = buildClaudeCmd(job, "claude");
    const addIdx = cmd.indexOf("--add-dir");
    expect(addIdx).toBeGreaterThan(-1);
    expect(cmd).toContain(storeDir);
  });

  test("generate job omits store --add-dir", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-claude-gen-"));
    const workDir = await mkdtemp(join(tmpdir(), "engram-claude-gen-work-"));
    const policy = rollupWritePolicy({ storeDir, workDir });
    const job: AgentJob = {
      processKey: "dream:dream-1",
      prompt: "generate",
      cwd: workDir,
      writePolicy: policy,
      addStoreDir: false,
    };
    const cmd = buildClaudeCmd(job, "claude");
    expect(cmd).not.toContain(storeDir);
    expect(cmd).toContain(workDir);
  });
});
