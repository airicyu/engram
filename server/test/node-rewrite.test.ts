import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteNodeLinks } from "../../.agents/skills/engram-node/scripts/rewrite-links.ts";

async function fixture() {
  const store = await mkdtemp(join(tmpdir(), "engram-node-"));
  const memories = join(store, "memories");
  await mkdir(join(memories, "chain/days"), { recursive: true });
  await mkdir(join(memories, "nodes/side/"), { recursive: true });
  await mkdir(join(memories, "nodes/main/"), { recursive: true });
  await mkdir(join(memories, "future-sight"), { recursive: true });
  await mkdir(join(memories, "pool"), { recursive: true });
  await mkdir(join(memories, "clarify/asking"), { recursive: true });
  await writeFile(join(memories, "nodes/side/side.md"), "# 從檔\n\n## Standing facts\n\n事實甲。\n");
  await writeFile(join(memories, "nodes/main/main.md"), "# 主檔\n\n## Standing facts\n\n事實乙。\n");
  await writeFile(
    join(memories, "chain/days/day.md"),
    "見 [[nodes/side/side|從檔顯示]] 與 [[nodes/side/side]]。\n",
  );
  await writeFile(join(memories, "future-sight/upcoming.md"), "[[nodes/side/side|從檔顯示]]\n");
  await writeFile(
    join(memories, "pool/pending.jsonl"),
    `${JSON.stringify({ id: "evt_1", raw: "提到 [[nodes/side/side|從檔顯示]]" })}\n`,
  );
  await writeFile(join(memories, "pool/archived.jsonl"), "[[nodes/side/side|從檔顯示]]\n");
  await writeFile(join(memories, "clarify/asking/q.md"), "[[nodes/side/side|從檔顯示]]\n");
  return store;
}

test("merge rewrites path and keeps label", async () => {
  const store = await fixture();
  try {
    await rewriteNodeLinks({ storeDir: store, mode: "merge", fromId: "side", intoId: "main" });
    const day = await readFile(join(store, "memories/chain/days/day.md"), "utf8");
    expect(day).toContain("[[nodes/main/main|從檔顯示]]");
    expect(day).toContain("[[nodes/main/main]]");
    expect(day).not.toContain("nodes/side/side");
    const pending = await readFile(join(store, "memories/pool/pending.jsonl"), "utf8");
    const row = JSON.parse(pending.trim()) as { id: string; raw: string };
    expect(row.id).toBe("evt_1");
    expect(row.raw).toContain("[[nodes/main/main|從檔顯示]]");
    const archived = await readFile(join(store, "memories/pool/archived.jsonl"), "utf8");
    expect(archived).toContain("nodes/side/side");
    const clarify = await readFile(join(store, "memories/clarify/asking/q.md"), "utf8");
    expect(clarify).toContain("nodes/side/side");
    const side = await readFile(join(store, "memories/nodes/side/side.md"), "utf8");
    expect(side.length).toBeGreaterThan(0);
  } finally {
    await rm(store, { recursive: true, force: true });
  }
});

test("0.7.0 skills state alias, empty shell, and ask match rules", async () => {
  const root = join(import.meta.dir, "../..");
  const nodeSkill = await readFile(join(root, ".agents/skills/engram-node/SKILL.md"), "utf8");
  expect(nodeSkill).toContain("aliases");
  expect(nodeSkill).toContain("rewrite-links.ts");
  expect(nodeSkill).not.toContain("merged_into");
  const distill = await readFile(join(root, ".agents/skills/engram-distill/SKILL.md"), "utf8");
  expect(distill).toContain("aliases");
  expect(distill).toContain("node-create");
  expect(distill).toContain("同一輪不得刪");
  const ask = await readFile(join(root, ".agents/skills/engram-ask/SKILL.md"), "utf8");
  expect(ask).toContain("唯一命中");
  expect(ask).toContain("沒有對上的節點");
});

test("delete unwraps label and removes the node directory", async () => {
  const store = await fixture();
  try {
    await rewriteNodeLinks({ storeDir: store, mode: "delete", fromId: "side" });
    const day = await readFile(join(store, "memories/chain/days/day.md"), "utf8");
    expect(day).toContain("見 從檔顯示 與 side。");
    expect(day).not.toContain("[[");
    await expect(readFile(join(store, "memories/nodes/side/side.md"), "utf8")).rejects.toThrow();
    const main = await readFile(join(store, "memories/nodes/main/main.md"), "utf8");
    expect(main).toContain("事實乙");
  } finally {
    await rm(store, { recursive: true, force: true });
  }
});
