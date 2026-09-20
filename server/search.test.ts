import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchMemories, snippetAround } from "./store.ts";
import { memoriesDir } from "./paths.ts";

test("snippetAround keeps ~40 chars each side, single line", () => {
  const text = "aaa " + "x".repeat(10) + " HITME " + "y".repeat(10) + " bbb";
  const snip = snippetAround(text, "HITME", 5);
  expect(snip.includes("HITME")).toBe(true);
  expect(snip.includes("\n")).toBe(false);
});

test("searchMemories hits day md and pending; skips archived and clarify", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-search-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "chain", "days", "2026-09"), { recursive: true });
  await mkdir(join(vault, "nodes", "acme"), { recursive: true });
  await mkdir(join(vault, "pool"), { recursive: true });
  await mkdir(join(vault, "clarify", "asking"), { recursive: true });
  await mkdir(join(vault, "_attachments", "uploads"), { recursive: true });

  await writeFile(
    join(vault, "chain", "days", "2026-09", "2026-09-16.md"),
    "## Fixture day\n\nToday we met about UNIQUE_DAY_TOKEN_QZ9.\n",
    "utf8",
  );
  await writeFile(
    join(vault, "nodes", "acme", "acme.md"),
    "# Acme\n\nNode body has UNIQUE_NODE_TOKEN_LM4.\n",
    "utf8",
  );
  await writeFile(
    join(vault, "pool", "pending.jsonl"),
    JSON.stringify({
      id: "evt_20260916_aaaaaa",
      ts: "2026-09-16T12:00:00+08:00",
      raw: "pending raw UNIQUE_PENDING_TOKEN_RW7",
      note: "pending note",
    }) +
      "\n" +
      JSON.stringify({
        id: "evt_20260916_bbbbbb",
        ts: "2026-09-16T13:00:00+08:00",
        raw: "other",
        note: "UNIQUE_NOTE_TOKEN_NT2",
      }) +
      "\n",
    "utf8",
  );
  await writeFile(
    join(vault, "pool", "archived.jsonl"),
    JSON.stringify({
      id: "evt_old",
      ts: "2026-09-01T12:00:00+08:00",
      raw: "UNIQUE_ARCHIVED_TOKEN_ZZ1 should not hit",
    }) + "\n",
    "utf8",
  );
  await writeFile(
    join(vault, "clarify", "asking", "cla_20260916_abcdef.md"),
    "---\nid: cla_20260916_abcdef\nts: 2026-09-16T12:00:00+08:00\n---\n\nUNIQUE_CLARIFY_TOKEN_CL3\n",
    "utf8",
  );
  await writeFile(join(vault, "_attachments", "uploads", "secret.txt"), "UNIQUE_ATTACH_TOKEN_AT5\n", "utf8");

  try {
    const dayHits = await searchMemories("UNIQUE_DAY_TOKEN_QZ9", vault);
    expect(dayHits.length).toBe(1);
    expect(dayHits[0]!.path).toBe("chain/days/2026-09/2026-09-16.md");
    expect(dayHits[0]!.snippet.toLowerCase()).toContain("unique_day_token_qz9");

    const nodeHits = await searchMemories("unique_node_token_lm4", vault);
    expect(nodeHits.some((h) => h.path === "nodes/acme/acme.md")).toBe(true);

    const pendingHits = await searchMemories("UNIQUE_PENDING_TOKEN_RW7", vault);
    expect(pendingHits.length).toBe(1);
    expect(pendingHits[0]!.path).toBe("pool/pending.jsonl");

    const noteHits = await searchMemories("UNIQUE_NOTE_TOKEN_NT2", vault);
    expect(noteHits.length).toBe(1);
    expect(noteHits[0]!.path).toBe("pool/pending.jsonl");

    expect((await searchMemories("UNIQUE_ARCHIVED_TOKEN_ZZ1", vault)).length).toBe(0);
    expect((await searchMemories("UNIQUE_CLARIFY_TOKEN_CL3", vault)).length).toBe(0);
    expect((await searchMemories("UNIQUE_ATTACH_TOKEN_AT5", vault)).length).toBe(0);

    const empty = await searchMemories("NO_SUCH_TOKEN_ANYWHERE_999", vault);
    expect(empty).toEqual([]);

    const blank = await searchMemories("   ", vault);
    expect(blank).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("searchMemories caps at 50", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-search-cap-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "chain", "days", "2026-09"), { recursive: true });
  for (let i = 0; i < 60; i++) {
    const id = `2026-09-${String((i % 28) + 1).padStart(2, "0")}-${i}`;
    await writeFile(join(vault, "chain", "days", "2026-09", `${id}.md`), `CAPTOKEN hit ${i}\n`, "utf8");
  }
  try {
    const hits = await searchMemories("CAPTOKEN", vault);
    expect(hits.length).toBe(50);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("demo vault search finds known day substring", async () => {
  const hits = await searchMemories("燈塔照片紀律", memoriesDir());
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.some((h) => h.path.includes("chain/"))).toBe(true);
});
