/** Narrow tests for clarify distill whitelist stripping (0.30). */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../../config";
import { ensureClarifyDirs, writeAside } from "../../store/memories/clarify";
import { ensureDreamDirs, draftDir } from "../../store/dreams/dream-runs";
import { prepareDreamDraft } from "../../store/dreams/file-pipeline";
import { ensureStoreGit } from "../../store/git";
import {
  isClarifyDistillAllowedRel,
  runClarifyDistill,
  stripClarifyDistillViolations,
} from "./distill";
import { MockClarifyDistillAgent } from "../../agent/clarify/mock";

describe("clarify distill", () => {
  let prevStore: string;
  let prevViolate: string | undefined;
  let dir: string;

  beforeEach(async () => {
    prevStore = config.storeDir;
    prevViolate = process.env.ENGRAM_CLARIFY_MOCK_VIOLATE;
    dir = await mkdtemp(join(tmpdir(), "engram-clarify-distill-"));
    (config as { storeDir: string }).storeDir = dir;
    await ensureClarifyDirs();
    await ensureDreamDirs();
    await ensureStoreGit();
  });

  afterEach(async () => {
    (config as { storeDir: string }).storeDir = prevStore;
    if (prevViolate === undefined) delete process.env.ENGRAM_CLARIFY_MOCK_VIOLATE;
    else process.env.ENGRAM_CLARIFY_MOCK_VIOLATE = prevViolate;
    await rm(dir, { recursive: true, force: true });
  });

  test("isClarifyDistillAllowedRel only node mains", () => {
    expect(isClarifyDistillAllowedRel("memories/nodes/acme/acme.md")).toBe(true);
    expect(isClarifyDistillAllowedRel("memories/nodes/acme/node.meta.yaml")).toBe(false);
    expect(isClarifyDistillAllowedRel("memories/chain/days/2026-08/2026-08-11.md")).toBe(false);
  });

  test("strip removes new non-main files", async () => {
    const runId = "run-strip";
    await prepareDreamDraft(runId);
    const before = new Map<string, string | null>();
    const badRel = "memories/chain/days/2099-01/2099-01-01.md";
    const abs = join(draftDir(runId), badRel);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, "# x\n", "utf8");
    const stripped = await stripClarifyDistillViolations(runId, before);
    expect(stripped).toContain(badRel);
  });

  test("strip restores modified pre-existing non-main files", async () => {
    const runId = "run-restore";
    await prepareDreamDraft(runId);
    const rel = "memories/chain/days/2026-08/2026-08-11.md";
    const abs = join(draftDir(runId), rel);
    await mkdir(join(abs, ".."), { recursive: true });
    const original = "# original ledger\n";
    await writeFile(abs, original, "utf8");
    const before = new Map<string, string | null>([[rel, original]]);
    await writeFile(abs, "# tampered by distill\n", "utf8");
    const stripped = await stripClarifyDistillViolations(runId, before);
    expect(stripped.some((s) => s.includes(rel))).toBe(true);
    expect(await readFile(abs, "utf8")).toBe(original);
  });

  test("E2: missing input.json and missing yaml ids → distill empty despite live aside", async () => {
    await writeAside("live aside must not be listed");
    const runId = "run-e2-empty";
    await prepareDreamDraft(runId);
    const out = await runClarifyDistill({
      dreamRunId: runId,
      snapshotIds: [],
      pendingItems: [],
      agent: new MockClarifyDistillAgent(),
    });
    expect(out.distilled_node_ids).toEqual([]);
  });

  test("distill no-op on empty pending", async () => {
    const runId = "run-empty";
    await prepareDreamDraft(runId);
    const out = await runClarifyDistill({
      dreamRunId: runId,
      snapshotIds: [],
      agent: new MockClarifyDistillAgent(),
    });
    expect(out.distilled_node_ids).toEqual([]);
  });

  test("distill writes draft node and strips chain violate", async () => {
    process.env.ENGRAM_CLARIFY_MOCK_VIOLATE = "1";
    const { id } = await writeAside("Acme is two years");
    const runId = "run-distill";
    await prepareDreamDraft(runId);
    // Seed report path for write policy
    await mkdir(join(config.storeDir, "dreams", "reports"), { recursive: true });
    await writeFile(join(config.storeDir, "dreams", "reports", `${runId}.md`), "# Dream report\n", "utf8");

    const out = await runClarifyDistill({
      dreamRunId: runId,
      snapshotIds: [id],
      agent: new MockClarifyDistillAgent(),
    });
    expect(out.distilled_node_ids.length).toBeGreaterThan(0);
    const chainBad = join(draftDir(runId), "memories/chain/days/2099-01/2099-01-01.md");
    await expect(Bun.file(chainBad).exists()).resolves.toBe(false);
  });
});
