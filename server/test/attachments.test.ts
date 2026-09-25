import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendPendingWithAttachments,
  extractAttachEmbeds,
  isValidAttachPath,
  saveAttachmentUpload,
  validateEventAttachments,
  ALLOWED_ATTACH_MIME,
  MAX_ATTACH_BYTES,
} from "../vault/index.ts";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("isValidAttachPath accepts formal uploads path", () => {
  expect(isValidAttachPath("_attachments/uploads/2026-09-20/menu.png")).toBe(true);
  expect(isValidAttachPath("_attachments/uploads/2026-09-20/../x.png")).toBe(false);
  expect(isValidAttachPath("_attachments/uploads/2026-09-20/a/b.png")).toBe(false);
  expect(isValidAttachPath("memories/_attachments/uploads/2026-09-20/a.png")).toBe(false);
});

test("extractAttachEmbeds exact paths; alias throws", () => {
  const raw = "午餐\n\n![[_attachments/uploads/2026-09-20/menu.png]]";
  expect(extractAttachEmbeds(raw)).toEqual(["_attachments/uploads/2026-09-20/menu.png"]);
  expect(() =>
    extractAttachEmbeds("x ![[_attachments/uploads/2026-09-20/menu.png|菜單]]"),
  ).toThrow("embed_alias");
});

test("saveAttachmentUpload writes formal day dir (no tmp)", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-att-"));
  const vault = join(root, "memories");
  await mkdir(vault, { recursive: true });
  try {
    const r = await saveAttachmentUpload(PNG_1X1, "shot.png", "image/png", vault);
    expect(r.path).toMatch(/^_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/shot\.png$/);
    expect(r.filename).toBe("shot.png");
    const abs = join(vault, ...r.path.split("/"));
    const bytes = await readFile(abs);
    expect(bytes.equals(PNG_1X1)).toBe(true);
    // no tmp dir
    const listing = await readFile(abs); // just ensure formal path
    expect(r.path.includes("/tmp/")).toBe(false);
    expect(listing.length).toBeGreaterThan(0);

    // collision renames
    const r2 = await saveAttachmentUpload(PNG_1X1, "shot.png", "image/png", vault);
    expect(r2.filename).not.toBe("shot.png");
    expect(r2.filename.startsWith("shot-")).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validateEventAttachments symmetry + missing file", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-att-val-"));
  const vault = join(root, "memories");
  const day = "2026-09-20";
  const dir = join(vault, "_attachments", "uploads", day);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "menu.png"), PNG_1X1);
  const path = `_attachments/uploads/${day}/menu.png`;

  try {
    // no attach → ok
    expect((await validateEventAttachments("plain text", null, vault)).ok).toBe(true);
    expect((await validateEventAttachments("plain", [], vault)).ok).toBe(true);

    // both sides match
    const ok = await validateEventAttachments(
      `午餐\n\n![[${path}]]`,
      [{ path, relationship: "當日菜單" }],
      vault,
    );
    expect(ok.ok).toBe(true);

    // only embed
    const onlyEmbed = await validateEventAttachments(`![[${path}]]`, null, vault);
    expect(onlyEmbed.ok).toBe(false);
    if (!onlyEmbed.ok) expect(onlyEmbed.error).toBe("asymmetric_attachments");

    // only attachments
    const onlyAtt = await validateEventAttachments("午餐", [{ path, relationship: "x" }], vault);
    expect(onlyAtt.ok).toBe(false);
    if (!onlyAtt.ok) expect(onlyAtt.error).toBe("asymmetric_attachments");

    // missing file
    const ghost = `_attachments/uploads/${day}/nope.png`;
    const miss = await validateEventAttachments(`![[${ghost}]]`, [{ path: ghost, relationship: "x" }], vault);
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error).toBe("missing_file");

    // alias
    const alias = await validateEventAttachments(
      `![[${path}|別名]]`,
      [{ path, relationship: "x" }],
      vault,
    );
    expect(alias.ok).toBe(false);
    if (!alias.ok) expect(alias.error).toBe("embed_alias");

    // empty relationship
    const rel = await validateEventAttachments(`![[${path}]]`, [{ path, relationship: "  " }], vault);
    expect(rel.ok).toBe(false);
    if (!rel.ok) expect(rel.error).toBe("missing_relationship");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("appendPendingWithAttachments writes attachments key only when present", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-att-evt-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "pool"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");
  await writeFile(join(vault, "pool", "archived.jsonl"), "", "utf8");
  const up = await saveAttachmentUpload(PNG_1X1, "a.png", "image/png", vault);
  try {
    const row = await appendPendingWithAttachments(
      `hi\n\n![[${up.path}]]`,
      [{ path: up.path, relationship: "本則附圖" }],
      vault,
    );
    expect(row.attachments?.length).toBe(1);
    expect(row.attachments![0]!.path).toBe(up.path);
    const line = (await readFile(join(vault, "pool", "pending.jsonl"), "utf8")).trim();
    const parsed = JSON.parse(line);
    expect(parsed.attachments[0].relationship).toBe("本則附圖");

    const plain = await appendPendingWithAttachments("no image here", null, vault);
    expect(plain.attachments).toBeUndefined();
    const lines = (await readFile(join(vault, "pool", "pending.jsonl"), "utf8")).trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]!);
    expect(last.attachments).toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ALLOWED mime and size constants", () => {
  expect(ALLOWED_ATTACH_MIME.has("image/png")).toBe(true);
  expect(ALLOWED_ATTACH_MIME.has("image/heic")).toBe(false);
  expect(MAX_ATTACH_BYTES).toBe(10 * 1024 * 1024);
});
