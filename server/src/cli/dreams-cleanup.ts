/**
 * Sweep stale dream staging artifacts under ENGRAM_STORE_DIR.
 *
 *   bun run dreams:cleanup
 *   bun run dreams:cleanup -- --dry-run
 *   ENGRAM_DREAM_STAGING_RETENTION_DAYS=0 bun run dreams:cleanup  # staging TTL off
 */
import { config } from "../config";
import { sweepDreamArtifacts } from "../store/dreams/cleanup";

const dryRun = process.argv.includes("--dry-run");

const result = await sweepDreamArtifacts({ dryRun });

console.log(JSON.stringify(result));
if (!dryRun) {
  console.error(`dream staging cleanup complete (store: ${config.storeDir})`);
}
