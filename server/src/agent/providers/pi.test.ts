/**
 * Pi argv builder (0.46).
 * Run: `cd server && bun test src/agent/providers/pi.test.ts`
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPiCmd, PI_ALLOWED_TOOLS, piWriteFence } from "./pi";
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

describe("buildPiCmd", () => {
  test("dream argv: -p, allowlist, isolation flags, prompt after --", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-pi-cmd-"));
    const ctx = fakeDreamCtx(storeDir, "dream-1");
    await mkdir(ctx.draft_dir, { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    const workDir = await mkdtemp(join(tmpdir(), "engram-pi-work-"));
    const policy = dreamWritePolicy(ctx, [workDir]);
    const job: AgentJob = {
      processKey: "dream:dream-1",
      prompt: "- dash prompt",
      cwd: workDir,
      writePolicy: policy,
    };
    const cmd = buildPiCmd(job, "pi");
    expect(cmd[0]).toBe("pi");
    expect(cmd).toContain("-p");
    expect(cmd).toContain("--no-session");
    expect(cmd).toContain("--no-context-files");
    expect(cmd).toContain("--no-extensions");
    expect(cmd).toContain("--no-skills");
    expect(cmd).toContain("--no-prompt-templates");
    expect(cmd).toContain("--no-approve");
    expect(cmd).not.toContain("--model");
    expect(cmd).not.toContain("--provider");
    const toolsIdx = cmd.indexOf("--tools");
    expect(toolsIdx).toBeGreaterThan(-1);
    expect(cmd[toolsIdx + 1]).toBe(PI_ALLOWED_TOOLS);
    expect(cmd[toolsIdx + 1]).not.toMatch(/bash|powershell/i);
    const dd = cmd.indexOf("--");
    expect(dd).toBeGreaterThan(-1);
    expect(cmd[dd + 1]).toBe("- dash prompt");
    const fenceIdx = cmd.indexOf("--append-system-prompt");
    expect(fenceIdx).toBeGreaterThan(-1);
    const fence = cmd[fenceIdx + 1]!;
    expect(fence).toContain(workDir);
    expect(fence).toContain(join(storeDir, "memories"));
  });

  test("ask fence lists jobDir", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-pi-ask-"));
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
    const fence = piWriteFence(policy);
    expect(fence).toContain(policy.writableRoots[0]!);
    expect(fence).toContain(join(storeDir, "memories"));
  });
});
