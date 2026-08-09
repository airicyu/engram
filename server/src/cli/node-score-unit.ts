/**
 * Unit self-check for node-score pure script (Track 1).
 * Usage: ENGRAM_STORE_DIR=/tmp/… bun run src/cli/node-score-unit.ts
 * Or: bun run src/cli/node-score-unit.ts  (uses temp dir)
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), `engram-node-score-unit-${Date.now()}`);

process.env.ENGRAM_STORE_DIR = TEST_DIR;

async function assert(cond: unknown, msg: string): Promise<void> {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(join(TEST_DIR, "memories", "nodes", "acme"), { recursive: true });
  await mkdir(join(TEST_DIR, "memories", "nodes", "alice"), { recursive: true });
  await writeFile(join(TEST_DIR, "memories", "nodes", "acme", "acme.md"), "acme\n");
  await writeFile(join(TEST_DIR, "memories", "nodes", "alice", "alice.md"), "alice\n");

  // Dynamic import after env is set so config.storeDir picks TEST_DIR
  const {
    SCORE,
    initNewNodeScore,
    incrementNodeScore,
    downscaleAll,
    readNodeScore,
    refreshRegistryMax,
    displayScore,
    maxCategory,
    collapseInvolvements,
    readRegistry,
  } = await import("../store/memories/node-score");

  // config may already be cached — re-check via homePath by reading scores under TEST_DIR
  const { config } = await import("../config");
  if (config.storeDir !== TEST_DIR) {
    // Force: module may have loaded config earlier in process; we set env before import so OK
    console.warn("warn: config.storeDir=", config.storeDir, "expected", TEST_DIR);
  }

  const asOf = "2026-08-01T12:00:00.000+08:00";

  await initNewNodeScore("acme", asOf);
  await initNewNodeScore("alice", asOf);
  let max = await refreshRegistryMax(asOf);
  await assert(max === SCORE.S0, `max after init = S0 got ${max}`);

  const acme0 = await readNodeScore("acme");
  await assert(acme0?.score === SCORE.S0, "acme S0");

  // Increment focus → +80
  const acme1 = await incrementNodeScore("acme", "focus", asOf);
  await assert(acme1.score === SCORE.S0 + 80, `acme after focus = ${acme1.score}`);

  // max category
  await assert(maxCategory("mention", "focus") === "focus", "maxCategory");
  await assert(maxCategory("update", "mention") === "update", "maxCategory update");

  const collapsed = collapseInvolvements([
    { id: "acme", category: "mention" },
    { id: "acme", category: "focus", reason: "main" },
    { id: "alice", category: "update" },
  ]);
  await assert(collapsed.byId.get("acme")?.category === "focus", "collapse focus");
  await assert(collapsed.invalid.length === 0, "no invalid");

  // Push acme over S_max to trigger downscale
  // S0+80 = 180; need > 2000. Write high scores directly.
  const { writeNodeScore } = await import("../store/memories/node-score");
  await writeNodeScore("acme", { score: 2100, score_timestamp: asOf });
  await writeNodeScore("alice", { score: 100, score_timestamp: asOf });
  await refreshRegistryMax(asOf);

  // Downscale excluding alice (simulates new node)
  const ds = await downscaleAll({ as_of: asOf, exclude_node_ids: ["alice"] });
  await assert(ds.ran === true, "downscale ran");
  const acmeAfter = await readNodeScore("acme");
  const aliceAfter = await readNodeScore("alice");
  await assert(aliceAfter?.score === 100, `exclude alice stays 100 got ${aliceAfter?.score}`);
  await assert(
    acmeAfter != null && acmeAfter.score < 2100 && acmeAfter.score >= SCORE.S_min,
    `acme scaled down got ${acmeAfter?.score}`,
  );

  // no-op when max ≤ S_target
  await writeNodeScore("acme", { score: 100, score_timestamp: asOf });
  await writeNodeScore("alice", { score: 100, score_timestamp: asOf });
  await refreshRegistryMax(asOf);
  const noop = await downscaleAll({ as_of: asOf });
  await assert(noop.ran === false, "downscale no-op under S_target");

  // display
  await assert(displayScore(100, 100) === 100, "display 100");
  await assert(displayScore(50, 100) === 50, "display 50");
  await assert(displayScore(1, 100) === 1, "display ceil at least 1");
  await assert(displayScore(100, null) === null, "display null max");
  await assert(displayScore(100, 0) === null, "display zero max");

  const reg = await readRegistry();
  await assert(reg != null && reg.max_score === 100, "registry max 100");

  console.log("node-score unit: OK");
  await rm(TEST_DIR, { recursive: true, force: true });
}

main().catch(async (e) => {
  console.error(e);
  await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
