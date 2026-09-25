import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

test("distill skill: independent Chain 文體 section with zh-Hant bans and examples", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-lite-distill/SKILL.md"), "utf8");
  expect(md).toMatch(/## Chain 文體/);
  expect(md).toMatch(/禁止.*口語粵語|口語粵語.*禁止/);
  expect(md).toMatch(/聊天|網路/);
  expect(md).toMatch(/Day — 壞/);
  expect(md).toMatch(/Day — 好/);
  expect(md).toMatch(/Week — 壞/);
  expect(md).toMatch(/Week — 好/);
  expect(md).toMatch(/一段一拍|逗號牆/);
  expect(md).not.toMatch(/clarify\/asking.*新建一題/);
});

test("data-spec: chain prose aligned with distill; distill does not own asking", async () => {
  const md = await readFile(join(root, "docs/data-spec.md"), "utf8");
  const chainSection = md.slice(md.indexOf("## Memory chain"));
  expect(chainSection).toMatch(/禁止.*口語粵語|口語粵語.*禁止/);
  expect(chainSection).toMatch(/分題材、寫成文/);
  expect(chainSection).toMatch(/合訂本|七篇/);
  expect(md).toMatch(/distill skill.*不要.*clarify\/asking/);
  expect(md).toMatch(/clarify-generate/);
  expect(md).not.toMatch(/釐清只由 distill 出題/);
});
