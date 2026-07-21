/**
 * Fixture apply: treat fixtures/*.jsonl as already-extracted L0.5,
 * materialize draft → commitDraft → clear fixture L1 (dev helper).
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
import { materializeDraft, commitDraft } from "../store/draft";
import { clearL1, appendSummary, listPoolEventIds, clearL1Scope } from "../store/l1";
import { parsePatch, type Patch } from "../dream/schema";
import { acquireLock, releaseLock } from "../store/lock";
import {
  newPendingRun,
  writeDreamRun,
  writeReport,
  removeDraft,
} from "../store/dream-runs";
import { buildDreamReport } from "../dream/report";
import { readPoolEntriesForScope } from "../store/l1";

const args = process.argv.slice(2);
const fixtureArg = args.find((a) => !a.startsWith("--"));
const doSeed = args.includes("--seed");
const keepL1 = args.includes("--keep-l1");
const noCommit = args.includes("--no-commit");

if (!fixtureArg) {
  console.error(
    "Usage: fixture-apply.ts <fixture.jsonl> [--seed] [--keep-l1] [--no-commit]",
  );
  process.exit(1);
}

const fixturePath = resolve(
  fixtureArg.startsWith("/") ? fixtureArg : resolve(import.meta.dir, "../../", fixtureArg),
);

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

if (!keepL1) {
  await appendSummary(`- fixture apply warmup for ${dreamRunId}\n`);
}

await acquireLock("fixture-apply");
try {
  const { written, patches: stored } = await appendPatchesIfNew(dreamRunId, patches);
  console.log(`L0.5 append: written=${written}, count=${stored.length}`);

  const scope = await listPoolEventIds();
  const manifest = await materializeDraft(dreamRunId, stored);
  console.log(`materialize: entries=${manifest.entries.length}`);

  const report = buildDreamReport({
    dream_run_id: dreamRunId,
    scope,
    events: await readPoolEntriesForScope(scope),
    patches: stored,
  });
  await writeReport(dreamRunId, report);
  await writeDreamRun(
    newPendingRun({ id: dreamRunId, scope, patch_count: stored.length }),
  );

  if (noCommit) {
    console.log("stopped at pending_review (--no-commit)");
  } else {
    const { committed } = await commitDraft(dreamRunId);
    console.log(JSON.stringify({ committed }, null, 2));
    if (scope.length) {
      await clearL1Scope(scope);
    } else {
      await clearL1();
    }
    await removeDraft(dreamRunId);
    const run = newPendingRun({ id: dreamRunId, scope, patch_count: stored.length });
    run.status = "committed";
    run.l1_clear_pending = false;
    await writeDreamRun(run);
  }
} finally {
  await releaseLock();
}
