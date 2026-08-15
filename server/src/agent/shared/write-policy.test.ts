/**
 * Phase 1 write-policy gates (0.20): G1.1–G1.4 unit coverage.
 * Run: `cd server && bun test src/agent/shared/write-policy.test.ts`
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  askWritePolicy,
  assertWritablePath,
  claudeAllowedToolsForWrites,
  claudeDisallowedTools,
  codexAddDirs,
  codexCdRoot,
  codexNeedsSkipGitRepoCheck,
  cursorWritableAddDirs,
  dreamWritePolicy,
  guardedWriteFile,
  isForbiddenLegacyNodePath,
  isPathInsideRoot,
  isWritablePath,
  liveMemoriesRoot,
  rollupWritePolicy,
  storeDreamsRoot,
} from "./write-policy";
import type { DreamContext } from "../dream/types";
import type { AskInput } from "../ask/types";
import { MockMaliciousLiveWriteRunner } from "../dream/mock";
import { MockAskMaliciousLiveWriteRunner } from "../ask/mock";

function fakeDreamCtx(storeDir: string, runId: string): DreamContext {
  return {
    dream_run_id: runId,
    timezone: "Asia/Hong_Kong",
    memory_language: "en",
    now: "2026-08-02T12:00:00+08:00",
    today: "2026-08-02",
    scope: ["e0000000001"],
    l1: { summary: "test", node_notes: {} },
    events: [{ id: "e0000000001", ts: "2026-08-02T12:00:00+08:00", raw: "hello" }],
    l2_current: [],
    existing_nodes: ["acme"],
    chain_summaries_current: [],
    store_dir: storeDir,
    draft_dir: join(storeDir, "dreams", "draft", runId),
    report_path: join(storeDir, "dreams", "reports", `${runId}.md`),
  };
}

describe("write-policy", () => {
  test("G1.1 dream policy denies live memories, allows draft＋report", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-"));
    const ctx = fakeDreamCtx(storeDir, "dream-test-1");
    await mkdir(ctx.draft_dir, { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    await mkdir(join(liveMemoriesRoot(storeDir), "nodes", "acme"), {
      recursive: true,
    });
    const liveWhat = join(liveMemoriesRoot(storeDir), "nodes", "acme", "acme.md");
    await writeFile(liveWhat, "ORIGINAL LIVE\n", "utf8");

    const policy = dreamWritePolicy(ctx);
    expect(
      isWritablePath(policy, join(ctx.draft_dir, "memories", "nodes", "x", "x.md")),
    ).toBe(true);
    expect(isWritablePath(policy, ctx.report_path)).toBe(true);
    expect(isWritablePath(policy, liveWhat)).toBe(false);
    expect(isWritablePath(policy, join(storeDir, "engram.workspace.yaml"))).toBe(false);

    expect(() => assertWritablePath(policy, liveWhat)).toThrow(/write_policy_denied/);

    await guardedWriteFile(policy, ctx.report_path, "# ok report\n");
    expect(await readFile(ctx.report_path, "utf8")).toContain("ok report");
    expect(await readFile(liveWhat, "utf8")).toBe("ORIGINAL LIVE\n");

    const tools = claudeAllowedToolsForWrites(policy);
    expect(tools.startsWith("Read")).toBe(true);
    expect(tools).toContain("Edit(//");
    expect(tools).not.toContain("Bash");
    expect(claudeDisallowedTools()).toBe("Bash");

    const addDirs = cursorWritableAddDirs(policy);
    expect(addDirs).toContain(ctx.draft_dir);
    expect(addDirs.some((d) => d === storeDir)).toBe(false);
  });

  test("0.28 forbids legacy understand/what.md and stub INDEX under draft", () => {
    const storeDir = "/tmp/engram-store-fake-028";
    const ctx = fakeDreamCtx(storeDir, "dream-legacy-1");
    const policy = dreamWritePolicy(ctx);
    const draftWhat = join(
      ctx.draft_dir,
      "memories",
      "nodes",
      "acme",
      "understand",
      "what.md",
    );
    const draftIndex = join(ctx.draft_dir, "memories", "nodes", "acme", "INDEX.md");
    const draftMain = join(ctx.draft_dir, "memories", "nodes", "acme", "acme.md");

    expect(isForbiddenLegacyNodePath(draftWhat)).toBe(true);
    expect(isForbiddenLegacyNodePath(draftIndex)).toBe(true);
    expect(isForbiddenLegacyNodePath(draftMain)).toBe(false);
    expect(isWritablePath(policy, draftWhat)).toBe(false);
    expect(isWritablePath(policy, draftIndex)).toBe(false);
    expect(isWritablePath(policy, draftMain)).toBe(true);
    expect(() => assertWritablePath(policy, draftWhat)).toThrow(/legacy node path/);
  });

  test("codex dream cd is store/dreams not store root", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-codex-"));
    const ctx = fakeDreamCtx(storeDir, "dream-codex-1");
    const workDir = join(tmpdir(), "engram-dream-work-fake");
    const policy = dreamWritePolicy(ctx, [workDir]);
    const cd = codexCdRoot(policy);
    expect(cd).toBe(storeDreamsRoot(storeDir));
    expect(cd).not.toBe(storeDir);
    expect(isPathInsideRoot(liveMemoriesRoot(storeDir), cd)).toBe(false);
    const addDirs = codexAddDirs(policy);
    expect(addDirs).toContain(workDir);
    expect(addDirs.some((d) => d === storeDir)).toBe(false);
  });

  test("codex ask cd is job dir and needs skip-git outside repo", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-codex-ask-"));
    const jobId = "ask-codex-1";
    const input: AskInput = {
      job_id: jobId,
      q: "what?",
      store_dir: storeDir,
      timezone: "Asia/Hong_Kong",
      memory_language: "en",
      dream_status: "idle",
      now: "2026-08-02T12:00:00+08:00",
      today: "2026-08-02",
    };
    const policy = askWritePolicy(input);
    const cd = codexCdRoot(policy);
    expect(cd).toBe(policy.writableRoots[0]);
    expect(cd).not.toBe(storeDreamsRoot(storeDir));
    expect(codexNeedsSkipGitRepoCheck(cd)).toBe(true);
    expect(codexAddDirs(policy)).toEqual([]);
  });

  test("G1.1 mock malicious runner leaves live untouched", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-mal-"));
    const runId = "dream-mal-1";
    const ctx = fakeDreamCtx(storeDir, runId);
    await mkdir(join(ctx.draft_dir, "memories"), { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    const liveWhat = join(liveMemoriesRoot(storeDir), "nodes", "acme", "acme.md");
    await mkdir(join(liveMemoriesRoot(storeDir), "nodes", "acme"), {
      recursive: true,
    });
    await writeFile(liveWhat, "ORIGINAL LIVE\n", "utf8");

    await new MockMaliciousLiveWriteRunner().dream(ctx);

    expect(await readFile(liveWhat, "utf8")).toBe("ORIGINAL LIVE\n");
    expect(await readFile(ctx.report_path, "utf8")).toContain("Dream report");
  });

  test("G1.2 draft＋report remain writable under dream policy", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-ok-"));
    const ctx = fakeDreamCtx(storeDir, "dream-ok-1");
    await mkdir(join(ctx.draft_dir, "memories"), { recursive: true });
    await mkdir(join(storeDir, "dreams", "reports"), { recursive: true });
    const policy = dreamWritePolicy(ctx);
    const draftMain = join(ctx.draft_dir, "memories", "nodes", "acme", "acme.md");
    await guardedWriteFile(policy, draftMain, "draft ok\n");
    await guardedWriteFile(policy, ctx.report_path, "# Dream report — ok\n");
    expect(await readFile(draftMain, "utf8")).toContain("draft ok");
    expect(await readFile(ctx.report_path, "utf8")).toContain("Dream report");
  });

  test("G1.3 ask policy denies live, allows job dir", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-wp-ask-"));
    const jobId = "ask-job-1";

    const input: AskInput = {
      job_id: jobId,
      q: "what?",
      store_dir: storeDir,
      timezone: "Asia/Hong_Kong",
      memory_language: "en",
      dream_status: "idle",
      now: "2026-08-02T12:00:00+08:00",
      today: "2026-08-02",
    };
    const liveWhat = join(liveMemoriesRoot(storeDir), "nodes", "acme", "acme.md");
    await mkdir(join(liveMemoriesRoot(storeDir), "nodes", "acme"), {
      recursive: true,
    });
    await writeFile(liveWhat, "ASK LIVE\n", "utf8");

    const policy = askWritePolicy(input);
    expect(isWritablePath(policy, liveWhat)).toBe(false);
    expect(() => assertWritablePath(policy, liveWhat)).toThrow(/write_policy_denied/);

    await new MockAskMaliciousLiveWriteRunner().ask(input);
    expect(await readFile(liveWhat, "utf8")).toBe("ASK LIVE\n");
  });

  test("G1.4 rollup write policy is draft＋workdir only", () => {
    const storeDir = "/tmp/engram-store-fake";
    const workDir = "/tmp/engram-rollup-work";
    const draftDir = join(storeDir, "dreams", "draft", "r1");
    const planOnly = rollupWritePolicy({ storeDir, workDir });
    expect(isWritablePath(planOnly, join(workDir, "plan.json"))).toBe(true);
    expect(isWritablePath(planOnly, join(draftDir, "memories", "x.md"))).toBe(false);

    const withDraft = rollupWritePolicy({ storeDir, workDir, draftDir });
    expect(isWritablePath(withDraft, join(draftDir, "memories", "chain", "x.md"))).toBe(true);
    expect(isWritablePath(withDraft, join(storeDir, "memories", "nodes", "a", "a.md"))).toBe(
      false,
    );
    expect(cursorWritableAddDirs(withDraft).includes(storeDir)).toBe(false);
  });
});
