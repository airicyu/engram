/** Narrow tests for clarify store schema／queues (0.30 Track A). */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../../config";
import {
  CLARIFY_ASKING_CAP,
  archivePendingToHistory,
  deleteAskingBySourceRunIds,
  ensureClarifyDirs,
  listAskingItems,
  listHistoryIds,
  listPendingIds,
  parseClarifyMarkdown,
  pruneAskingToCap,
  renderClarifyMarkdown,
  submitAsking,
  writeAskingFile,
  writeAside,
} from "./clarify";
import { ensureStoreGit } from "../git";

describe("clarify store", () => {
  let prevStore: string;
  let dir: string;

  beforeEach(async () => {
    prevStore = config.storeDir;
    dir = await mkdtemp(join(tmpdir(), "engram-clarify-"));
    (config as { storeDir: string }).storeDir = dir;
    await ensureClarifyDirs();
    await ensureStoreGit();
  });

  afterEach(async () => {
    (config as { storeDir: string }).storeDir = prevStore;
    await rm(dir, { recursive: true, force: true });
  });

  test("round-trip asking markdown", () => {
    const md = renderClarifyMarkdown({
      fm: {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        kind: "prompt",
        created_at: "2026-08-11T12:00:00.000+08:00",
        source_dream_run_id: "run-1",
        related_nodes: ["acme"],
      },
      question: "What is GA?",
    });
    const parsed = parseClarifyMarkdown(md, "asking");
    expect(parsed.question).toBe("What is GA?");
    expect(parsed.fm.related_nodes).toEqual(["acme"]);
  });

  test("submit moves asking → pending", async () => {
    await writeAskingFile({
      id: "q1",
      question: "Why?",
      source_dream_run_id: "run-a",
      related_nodes: ["n1"],
    });
    const moved = await submitAsking("q1", "Because.");
    expect(moved?.id).toBe("q1");
    expect(await listAskingItems()).toHaveLength(0);
    expect(await listPendingIds()).toEqual(["q1"]);
  });

  test("aside writes pending kind aside", async () => {
    const { id } = await writeAside("Extra note");
    expect(await listPendingIds()).toContain(id);
  });

  test("archive pending → history", async () => {
    await writeAside("note");
    const ids = await listPendingIds();
    await archivePendingToHistory(ids);
    expect(await listPendingIds()).toHaveLength(0);
    expect(await listHistoryIds()).toEqual(ids);
  });

  test("deleteAskingBySourceRunIds", async () => {
    await writeAskingFile({ id: "a", question: "Q1", source_dream_run_id: "run-old" });
    await writeAskingFile({ id: "b", question: "Q2", source_dream_run_id: "run-keep" });
    const deleted = await deleteAskingBySourceRunIds(["run-old"]);
    expect(deleted).toEqual(["a"]);
    const left = await listAskingItems();
    expect(left.map((x) => x.id)).toEqual(["b"]);
  });

  test("pruneAskingToCap keeps ≤10", async () => {
    for (let i = 0; i < CLARIFY_ASKING_CAP + 3; i++) {
      await writeAskingFile({
        id: `p${i}`,
        question: `Q${i}`,
        source_dream_run_id: i < 3 ? "old" : "new",
        created_at: `2026-08-11T12:00:${String(i).padStart(2, "0")}.000+08:00`,
      });
    }
    const pruned = await pruneAskingToCap("new");
    expect(pruned.length).toBe(3);
    expect((await listAskingItems()).length).toBe(CLARIFY_ASKING_CAP);
  });
});
