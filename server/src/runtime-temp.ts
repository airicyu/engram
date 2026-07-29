/**
 * Runtime temp root outside the memory store (ask jobs, dream agent workdirs).
 * Root from `config.tempDir` (`ENGRAM_TEMP_DIR`, default `/tmp`).
 */

import { join } from "node:path";
import { config } from "./config";

/** Absolute path under configured temp dir, namespaced with `engram/`. */
export function runtimeTempPath(...parts: string[]): string {
  return join(config.tempDir, "engram", ...parts);
}

/** Disposable work dir: `{tempDir}/{prefix}-{timestamp}` (cleaned by caller). */
export function runtimeTempWorkDir(prefix: string): string {
  return join(config.tempDir, `${prefix}-${Date.now()}`);
}
