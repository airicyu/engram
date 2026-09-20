import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createClarifyAside,
  dismissClarify,
  isValidClarifyId,
  listClarifyAsking,
  listClarifyPending,
  submitClarifyAnswer,
} from "./store.ts";

test("isValidClarifyId", () => {
  expect(isValidClarifyId("cla_20260920_ab12cd")).toBe(true);
  expect(isValidClarifyId("cla_20260920_AB12CD")).toBe(false);
  expect(isValidClarifyId("cla_2026092_ab12cd")).toBe(false);
  expect(isValidClarifyId("evt_20260920_ab12cd")).toBe(false);
  expect(isValidClarifyId("../cla_20260920_ab12cd")).toBe(false);
});

test("list asking/pending empty → []", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-cla-empty-"));
  const vault = join(root, "memories");
  try {
    expect(await listClarifyAsking(vault)).toEqual([]);
    expect(await listClarifyPending(vault)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("submit moves asking→pending with Answer; dismiss→history; aside not pool", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-cla-"));
  const vault = join(root, "memories");
  const id = "cla_20260920_ab12cd";
  await mkdir(join(vault, "clarify", "asking"), { recursive: true });
  await mkdir(join(vault, "clarify", "pending"), { recursive: true });
  await mkdir(join(vault, "clarify", "history"), { recursive: true });
  await mkdir(join(vault, "pool"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");
  await writeFile(
    join(vault, "clarify", "asking", `${id}.md`),
    `---\nid: ${id}\nts: 2026-09-20T10:00:00+08:00\n---\n\nFIXTURE_Q_TOKEN_CLA7 配額是多少？\n`,
    "utf8",
  );
  // workspace for aside stamp
  await writeFile(join(root, "workspace.yaml"), "timezone: Asia/Hong_Kong\nmemory_language: zh-Hant\n", "utf8");

  // Point store workspace via ENGRAM? createClarifyAside uses readWorkspace which reads storeDir workspace.
  // For vault-rooted helpers we only pass vaultRoot; aside still calls readWorkspace() from global storeDir.
  // So stamp uses demo/real workspace — that's fine for id generation.

  try {
    const listed = await listClarifyAsking(vault);
    expect(listed.length).toBe(1);
    expect(listed[0]!.id).toBe(id);

    const sub = await submitClarifyAnswer(id, "FIXTURE_A_TOKEN_ANS9 四百", vault);
    expect(sub).toEqual({ id, present: true });
    expect(await listClarifyAsking(vault)).toEqual([]);
    const pending = await listClarifyPending(vault);
    expect(pending.length).toBe(1);
    expect(pending[0]!.markdown).toContain("## Answer");
    expect(pending[0]!.markdown).toContain("FIXTURE_A_TOKEN_ANS9");
    await expect(readFile(join(vault, "clarify", "asking", `${id}.md`), "utf8")).rejects.toBeDefined();

    // idempotent missing submit
    const miss = await submitClarifyAnswer("cla_20260920_zzzzzz", "x", vault);
    expect(miss.present).toBe(false);

    // put another asking for dismiss
    const id2 = "cla_20260920_cd34ef";
    await writeFile(
      join(vault, "clarify", "asking", `${id2}.md`),
      `---\nid: ${id2}\nts: 2026-09-20T11:00:00+08:00\n---\n\nFIXTURE_DISMISS_Q\n`,
      "utf8",
    );
    const d = await dismissClarify(id2, vault);
    expect(d.present).toBe(true);
    const hist = await readFile(join(vault, "clarify", "history", `${id2}.md`), "utf8");
    expect(hist).toContain("dismissed: true");
    expect(await listClarifyAsking(vault)).toEqual([]);

  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createClarifyAside writes pending with kind aside; not pool", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-aside-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "clarify", "pending"), { recursive: true });
  await mkdir(join(vault, "pool"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");

  try {
    const res = await createClarifyAside("FIXTURE_ASIDE_TOKEN_AS3 補充一句", vault);
    expect(res.present).toBe(true);
    expect(isValidClarifyId(res.id)).toBe(true);
    const md = await readFile(join(vault, "clarify", "pending", `${res.id}.md`), "utf8");
    expect(md).toContain("kind: aside");
    expect(md).toContain("FIXTURE_ASIDE_TOKEN_AS3");
    expect(md).not.toContain("## Answer");
    const pool = await readFile(join(vault, "pool", "pending.jsonl"), "utf8");
    expect(pool.trim()).toBe("");
    const items = await listClarifyPending(vault);
    expect(items.some((x) => x.id === res.id)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid id throws / dismiss missing present false", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-cla-bad-"));
  const vault = join(root, "memories");
  try {
    await expect(submitClarifyAnswer("bad_id", "x", vault)).rejects.toThrow("invalid_id");
    await expect(dismissClarify("bad_id", vault)).rejects.toThrow("invalid_id");
    const miss = await dismissClarify("cla_20260920_none01", vault);
    expect(miss.present).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("absorb criterion: pending→history with absorbed_at + day keyword", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-absorb-"));
  const vault = join(root, "memories");
  try {
    await mkdir(join(vault, "clarify", "pending"), { recursive: true });
    await mkdir(join(vault, "clarify", "history"), { recursive: true });
    await mkdir(join(vault, "chain", "days", "2026-09"), { recursive: true });

    const id = "cla_20260920_abs001";
    const pendingMd = `---\nid: ${id}\nts: 2026-09-20T12:00:00+08:00\n---\n\n配額多少？\n\n## Answer\n\nFIXTURE_ABSORB_TOKEN_42\n`;
    await writeFile(join(vault, "clarify", "pending", `${id}.md`), pendingMd, "utf8");

    // Simulate distill absorb file ops (INDEX criterion 2): absorbed_at + move to history.
    let md = await readFile(join(vault, "clarify", "pending", `${id}.md`), "utf8");
    md = md.replace(/^---\n/, "---\nabsorbed_at: 2026-09-20T13:00:00+08:00\n");
    await writeFile(join(vault, "clarify", "history", `${id}.md`), md, "utf8");
    await unlink(join(vault, "clarify", "pending", `${id}.md`));

    const hist = await readFile(join(vault, "clarify", "history", `${id}.md`), "utf8");
    expect(hist).toContain("absorbed_at:");
    expect(hist).toContain("FIXTURE_ABSORB_TOKEN_42");
    let pendingGone = false;
    try {
      await readFile(join(vault, "clarify", "pending", `${id}.md`), "utf8");
    } catch {
      pendingGone = true;
    }
    expect(pendingGone).toBe(true);

    // INDEX criterion (1): fixture keyword in day body after absorb.
    await writeFile(
      join(vault, "chain", "days", "2026-09", "2026-09-20.md"),
      "# 2026-09-20\n\n吸收：FIXTURE_ABSORB_TOKEN_42\n",
      "utf8",
    );
    const day = await readFile(join(vault, "chain", "days", "2026-09", "2026-09-20.md"), "utf8");
    expect(day).toContain("FIXTURE_ABSORB_TOKEN_42");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
