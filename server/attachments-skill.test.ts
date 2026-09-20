import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

test("distill skill teaches attachment relationship / embed (no pixels)", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-lite-distill/SKILL.md"), "utf8");
  expect(md).toContain("attachments");
  expect(md).toContain("relationship");
  expect(md).toContain("![[_attachments/uploads/");
  expect(md).toMatch(/不要.*像素|看不見/);
  expect(md).toContain("禁止發明 path");
});
