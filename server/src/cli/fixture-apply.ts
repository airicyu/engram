/**
 * Fixture apply: treat fixtures/*.jsonl as already-extracted L0.5, run apply only.
 *
 * Usage:
 *   bun run src/cli/fixture-apply.ts fixtures/happy.jsonl
 *   bun run src/cli/fixture-apply.ts fixtures/with-bad.jsonl --seed
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureEngramHome } from "../store/home";
import { seedNode } from "../store/nodes";
import { appendPatchesIfNew } from "../store/patches";
import { applyAndClearL1 } from "../dream/apply";
import { parsePatch, type Patch } from "../dream/schema";
import { appendSummary } from "../store/l1";
import { acquireLock, releaseLock } from "../store/lock";

const args = process.argv.slice(2);
const fixtureArg = args.find((a) => !a.startsWith("--"));
const doSeed = args.includes("--seed");
const keepL1 = args.includes("--keep-l1");

if (!fixtureArg) {
  console.error("Usage: fixture-apply.ts <fixture.jsonl> [--seed] [--keep-l1]");
  process.exit(1);
}

const fixturePath = resolve(fixtureArg.startsWith("/") ? fixtureArg : resolve(import.meta.dir, "../../", fixtureArg));

await ensureEngramHome();

if (doSeed) {
  await seedNode("acme", {
    kind: "org",
    aliases: ["Acme"],
    what: "Partner organization we integrate with.",
  });
  await seedNode("alice", {
    kind: "person",
    aliases: [],
    what: "A contact person.",
  });
  await seedNode("aurora", {
    kind: "theme",
    aliases: [],
    what: "Theme node placeholder.",
  });
  console.log("seeded nodes: acme, alice, aurora");
}

const text = await readFile(fixturePath, "utf8");
const patches: Patch[] = text
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => parsePatch(JSON.parse(line)));

const dreamRunId = patches[0]?.dream_run_id;
if (!dreamRunId) {
  console.error("fixture empty");
  process.exit(1);
}

// Ensure L1 nonempty so clear is observable (unless --keep-l1 skip seed of L1)
if (!keepL1) {
  await appendSummary(`- fixture apply warmup for ${dreamRunId}\n`);
}

await acquireLock("fixture-apply");
try {
  const { written, patches: stored } = await appendPatchesIfNew(dreamRunId, patches);
  console.log(`L0.5 append: written=${written}, count=${stored.length}`);
  const result = await applyAndClearL1(stored);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await releaseLock();
}
