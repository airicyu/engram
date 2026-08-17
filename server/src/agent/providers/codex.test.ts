/**
 * Codex argv builder (0.23).
 * Run: `cd server && bun test src/agent/providers/codex.test.ts`
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexCmd } from "./codex";
import { askWritePolicy, dreamWritePolicy } from "../shared/write-policy";
import type { DreamContext } from "../dream/types";
import type { AskInput } from "../ask/types";
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

describe("buildCodexCmd", () => {
  test("dream argv: exec + workspace-write + dreams cd", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-codex-cmd-"));
    const ctx = fakeDreamCtx(storeDir, "dream-1");
    await mkdir(ctx.draft_dir, { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    const workDir = await mkdtemp(join(tmpdir(), "engram-codex-work-"));
    const policy = dreamWritePolicy(ctx, [workDir]);
    const job: AgentJob = {
      processKey: "dream:dream-1",
      prompt: "do dream",
      cwd: workDir,
      writePolicy: policy,
    };
    const cmd = buildCodexCmd(job, "codex");
    expect(cmd[0]).toBe("codex");
    expect(cmd).toContain("exec");
    expect(cmd).toContain("workspace-write");
    expect(cmd).not.toContain("--ask-for-approval");
    const cdIdx = cmd.indexOf("--cd");
    expect(cdIdx).toBeGreaterThan(-1);
    expect(cmd[cdIdx + 1]).toBe(join(storeDir, "dreams"));
    expect(cmd[cdIdx + 1]).not.toBe(storeDir);
    expect(cmd).toContain("--add-dir");
    expect(cmd).toContain(workDir);
    expect(cmd.at(-1)).toBe("do dream");
  });

  test("ask argv includes --skip-git-repo-check", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-codex-ask-cmd-"));
    const input: AskInput = {
      job_id: "ask-cmd-1",
      q: "q",
      store_dir: storeDir,
      timezone: "Asia/Hong_Kong",
      memory_language: "en",
      dream_status: "idle",
      now: "2026-08-02T12:00:00+08:00",
      today: "2026-08-02",
    };
    const policy = askWritePolicy(input);
    const jobDir = policy.writableRoots[0]!;
    const job: AgentJob = {
      processKey: "ask:ask-cmd-1",
      prompt: "answer",
      cwd: jobDir,
      writePolicy: policy,
      logMeta: { job_id: "ask-cmd-1" },
    };
    const cmd = buildCodexCmd(job, "codex");
    expect(cmd).toContain("exec");
    expect(cmd).toContain("--skip-git-repo-check");
    const cdIdx = cmd.indexOf("--cd");
    expect(cmd[cdIdx + 1]).toBe(jobDir);
  });
});
