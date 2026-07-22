/**
 * Wipe ENGRAM_HOME and recreate an empty store (no seed nodes, no fixtures).
 *
 *   bun run reset
 *   ENGRAM_HOME=/path/to/data bun run reset
 */
import { rm } from "node:fs/promises";
import { config } from "../config";
import { ensureEngramHome } from "../store/home";

const home = config.engramHome;
console.log(`Resetting ENGRAM_HOME=${home}`);

await rm(home, { recursive: true, force: true });
await ensureEngramHome();

console.log("Done. Empty store ready (no nodes, no events, no patches).");
console.log("Start server: bun run start");
console.log("Then capture your own data via POST /capture");
