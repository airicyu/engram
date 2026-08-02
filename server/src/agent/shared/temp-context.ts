/**
 * Temp dir + JSON context file for agent runs that need a disposable workspace.
 * Uses `config.tempDir` (ENGRAM_TEMP_DIR, default `/tmp`).
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { runtimeTempWorkDir } from "../../runtime-temp";

export type TempJsonContextOpts = {
  /** Directory name prefix under ENGRAM_TEMP_DIR, e.g. engram-dream. */
  prefix: string;
  /** Filename inside the temp dir, e.g. dream-context.json. */
  filename: string;
  value: unknown;
};

/**
 * mkdir → write JSON → run callback with (workDir, contextPath) → always rm workDir.
 */
export async function withTempJsonContext<T>(
  opts: TempJsonContextOpts,
  fn: (workDir: string, contextPath: string) => Promise<T>,
): Promise<T> {
  const workDir = runtimeTempWorkDir(opts.prefix);
  await mkdir(workDir, { recursive: true });
  try {
    const contextPath = join(workDir, opts.filename);
    await writeFile(contextPath, JSON.stringify(opts.value, null, 2), "utf8");
    return await fn(workDir, contextPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
