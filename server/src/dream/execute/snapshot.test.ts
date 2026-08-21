/** Frozen pool／clarify snapshots must not pick up later live writes. */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../../config";
import { captureActivity, withCaptureLockForTests } from "../../store/memories/capture";
import {
  appendPoolEntry,
  clearShortTermMemoryScope,
  readPoolEntries,
} from "../../store/memories/short-term-memory";
import {
  ensureClarifyDirs,
  writeAside,
  withClarifyWriteLock,
} from "../../store/memories/clarify";
import { ensureDreamDirs } from "../../store/dreams/dream-runs";
import { ensureStoreGit } from "../../store/git";
import { prepareDreamDraft } from "../../store/dreams/file-pipeline";
import { MockClarifyDistillAgent } from "../../agent/clarify/mock";
import { buildDreamContext } from "./context";
import { runClarifyDistill } from "../clarify/distill";

describe("0.41 frozen snapshots", () => {
  let prevStore: string;
  let dir: string;

  beforeEach(async () => {
    prevStore = config.storeDir;
    dir = await mkdtemp(join(tmpdir(), "engram-snap-"));
    (config as { storeDir: string }).storeDir = dir;
    await ensureClarifyDirs();
    await ensureDreamDirs();
    await ensureStoreGit();
    await mkdir(join(dir, "memories", "activities"), { recursive: true });
    await writeFile(join(dir, "memories", "activities", "events.jsonl"), "", "utf8");
  });

  afterEach(async () => {
    (config as { storeDir: string }).storeDir = prevStore;
    await rm(dir, { recursive: true, force: true });
  });

  test("pool append after snapshot is not in dream context", async () => {
    await appendPoolEntry({
      id: "e0000000001",
      ts: "2026-08-21T12:00:00+08:00",
      raw: "frozen note",
    });
    const frozen = structuredClone(await readPoolEntries());
    await appendPoolEntry({
      id: "e0000000002",
      ts: "2026-08-21T12:01:00+08:00",
      raw: "after freeze",
    });
    const ctx = await buildDreamContext("dream-snap-1", frozen);
    expect(ctx.events.map((e) => e.id)).toEqual(["e0000000001"]);
    expect(ctx.l1.summary).toContain("frozen note");
    expect(ctx.l1.summary).not.toContain("after freeze");
  });

  test("aside after snapshot is not distilled", async () => {
    const { id: frozenId } = await withClarifyWriteLock(() => writeAside("Acme lease is two years"));
    const frozenItems = [
      {
        id: frozenId,
        kind: "aside" as const,
        created_at: "2026-08-21T12:00:00+08:00",
        answered_at: "2026-08-21T12:00:00+08:00",
        source_dream_run_id: null,
        related_nodes: [] as string[],
        question: null,
        answer: "Acme lease is two years",
      },
    ];
    await withClarifyWriteLock(() => writeAside("later aside must not distill"));
    const runId = "dream-distill-snap";
    await prepareDreamDraft(runId);
    const out = await runClarifyDistill({
      dreamRunId: runId,
      snapshotIds: frozenItems.map((i) => i.id),
      pendingItems: frozenItems,
      agent: new MockClarifyDistillAgent(),
    });
    expect(out.snapshot_ids).toEqual([frozenId]);
    expect(out.narrative.toLowerCase()).not.toContain("later aside");
  });

  test("clear scope under capture lock does not drop a queued append", async () => {
    await appendPoolEntry({
      id: "e0000000001",
      ts: "2026-08-21T12:00:00+08:00",
      raw: "in scope",
    });
    await writeFile(
      join(dir, "memories", "activities", "events.jsonl"),
      `${JSON.stringify({ id: "e0000000001", ts: "2026-08-21T12:00:00+08:00", source: "api", raw: "in scope" })}\n`,
      "utf8",
    );
    let releaseHold!: () => void;
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    const clearing = withCaptureLockForTests(async () => {
      await hold;
      await clearShortTermMemoryScope(["e0000000001"]);
    });
    const appending = captureActivity({ raw: "queued after freeze" });
    await new Promise((r) => setTimeout(r, 30));
    releaseHold();
    await clearing;
    const { event_id } = await appending;
    const ids = (await readPoolEntries()).map((e) => e.id);
    expect(ids).toContain(event_id);
    expect(ids).not.toContain("e0000000001");
  });
});
