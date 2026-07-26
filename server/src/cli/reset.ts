/**
 * Wipe ENGRAM_STORE_DIR and recreate an empty store (no nodes, no events).
 *
 *   bun run reset
 *   ENGRAM_STORE_DIR=/path/to/data bun run reset
 */
import { rm } from "node:fs/promises";
import { config } from "../config";
import { ensureEngramHome } from "../store/home";

const home = config.storeDir;
console.log(`Resetting ENGRAM_STORE_DIR=${home}`);

await rm(home, { recursive: true, force: true });
await ensureEngramHome();

console.log("Done. Empty store ready (no nodes, no events, no patches).");
console.log("Start server: bun run start");
console.log("Then capture your own data via POST /activities");
