/**
 * Clarify generate gates (0.45): skip before mkdtemp.
 * Run: cd server && bun test src/dream/clarify/generate.test.ts
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../../config";
import {
  CLARIFY_ASKING_CAP,
  ensureClarifyDirs,
  writeAskingFile,
} from "../../store/memories/clarify";
import { seedNode } from "../../store/memories/nodes";
import { ensureDreamDirs } from "../../store/dreams/dream-runs";
import { ensureStoreGit } from "../../store/git";
import { runClarifyGenerate } from "./generate";
import type { ClarifyGenerateAgent, ClarifyGenerateResult } from "../../agent/clarify/types";

class SpyGenerateAgent implements ClarifyGenerateAgent {
  calls = 0;
  async generate(): Promise<ClarifyGenerateResult> {
    this.calls += 1;
    return { prompts: [] };
  }
}

describe("runClarifyGenerate gates", () => {
  let prevStore: string;
  let dir: string;

  beforeEach(async () => {
    prevStore = config.storeDir;
    dir = await mkdtemp(join(tmpdir(), "engram-clarify-gen-"));
    (config as { storeDir: string }).storeDir = dir;
    await ensureClarifyDirs();
    await ensureDreamDirs();
    await ensureStoreGit();
  });

  afterEach(async () => {
    (config as { storeDir: string }).storeDir = prevStore;
    await rm(dir, { recursive: true, force: true });
  });

  test("zero nodes → no-op, agent not called", async () => {
    const agent = new SpyGenerateAgent();
    const out = await runClarifyGenerate({
      dreamRunId: "run-no-nodes",
      week_rollup_executed: true,
      agent,
    });
    expect(out.noop).toBe(true);
    expect(agent.calls).toBe(0);
  });

  test("asking at cap → no-op, agent not called", async () => {
    await seedNode("acme", { kind: "org" });
    for (let i = 0; i < CLARIFY_ASKING_CAP; i++) {
      await writeAskingFile({
        id: `ask-${String(i).padStart(2, "0")}`,
        question: `Q ${i}?`,
        source_dream_run_id: "prior",
      });
    }
    const agent = new SpyGenerateAgent();
    const out = await runClarifyGenerate({
      dreamRunId: "run-cap",
      week_rollup_executed: true,
      agent,
    });
    expect(out.noop).toBe(true);
    expect(agent.calls).toBe(0);
  });

  test("no week rollup this run → no-op", async () => {
    await seedNode("acme", { kind: "org" });
    const agent = new SpyGenerateAgent();
    const out = await runClarifyGenerate({
      dreamRunId: "run-no-week",
      week_rollup_executed: false,
      agent,
    });
    expect(out.noop).toBe(true);
    expect(agent.calls).toBe(0);
  });

  test("week executed + node + under cap → generate once", async () => {
    await seedNode("acme", { kind: "org" });
    const agent = new SpyGenerateAgent();
    const out = await runClarifyGenerate({
      dreamRunId: "run-week",
      week_rollup_executed: true,
      agent,
    });
    expect(out.noop).toBe(false);
    expect(agent.calls).toBe(1);
  });
});
