import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

test("distill skill does not own asking generation", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-lite-distill/SKILL.md"), "utf8");
  expect(md).toContain("clarify/pending");
  expect(md).toMatch(/不寫 asking|不要.*clarify\/asking|engram-lite-clarify-generate/);
});

test("clarify-generate skill enforces MIN 3 MAX 5", async () => {
  const md = await readFile(join(root, ".agents/skills/engram-lite-clarify-generate/SKILL.md"), "utf8");
  expect(md).toContain("clarify/asking");
  expect(md).toMatch(/MIN 3/);
  expect(md).toMatch(/MAX 5/);
});

test("pi.ts program-orchestrates two independent sessions", async () => {
  const md = await readFile(join(root, "server/pi.ts"), "utf8");
  expect(md).toContain("engram-lite-distill");
  expect(md).toContain("engram-lite-clarify-generate");
  expect(md).toContain("CLARIFY_GENERATE_MIN");
  expect(md).toContain("runDistillOrchestrated");
  expect(md).toContain("createAgentSession");
  // must not be single-prompt two-phase
  expect(md).not.toMatch(/Phase 1.*Phase 2|two-phase distill job \(same store\)/s);
  expect(md).toContain("retry generate");
});

test("orchestration.md documents two sessions", async () => {
  const md = await readFile(join(root, "docs/architecture/orchestration.md"), "utf8");
  expect(md).toContain("兩次獨立 Pi session");
  expect(md).toContain("Session A");
  expect(md).toContain("Session B");
});
