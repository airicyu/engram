import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

test("distill skill does not own asking generation", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-distill/SKILL.md"), "utf8");
  expect(md).toContain("clarify/pending");
  expect(md).toMatch(/不寫 asking|不要.*clarify\/asking|engram-clarify-generate/);
});

test("clarify-generate skill enforces MIN 3 MAX 5", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-clarify-generate/SKILL.md"), "utf8");
  expect(md).toContain("clarify/asking");
  expect(md).toMatch(/MIN 3/);
  expect(md).toMatch(/MAX 5/);
});

test("pi.ts program-orchestrates two independent sessions", async () => {
  const md = await readFile(join(root, "server/worker/pi.ts"), "utf8");
  expect(md).toContain("engram-distill");
  expect(md).toContain("engram-clarify-generate");
  expect(md).toContain("CLARIFY_GENERATE_MIN");
  expect(md).toContain("runDistillOrchestrated");
  expect(md).toContain("createAgentSession");
  // must not be single-prompt two-phase
  expect(md).not.toMatch(/Phase 1.*Phase 2|two-phase distill job \(same store\)/s);
  expect(md).toContain("retry generate");
});

test("clarify-generate skill does not ask about empty days", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-clarify-generate/SKILL.md"), "utf8");
  expect(md).toContain("不要問「某日有沒有值得記的事」");
  expect(md).toContain("jobs/");
});

test("distill and ask skills describe the open week marker", async () => {
  const distill = await readFile(join(root, ".agents/skills/engram-distill/SKILL.md"), "utf8");
  expect(distill).toContain("open: true");
  expect(distill).toContain("跳過");
  const ask = await readFile(join(root, ".agents/skills/engram-ask/SKILL.md"), "utf8");
  expect(ask).toContain("open: true");
  expect(ask).toContain("本週至今");
});

test("orchestration.md documents two sessions", async () => {
  const md = await readFile(join(root, "docs/architecture/orchestration.md"), "utf8");
  expect(md).toContain("兩次獨立 Pi session");
  expect(md).toContain("Session A");
  expect(md).toContain("Session B");
});
