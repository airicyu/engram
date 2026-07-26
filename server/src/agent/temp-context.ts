/** Temp dir + JSON context file for agent runs that need a disposable workspace. */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type TempJsonContextOpts = {
  /** Directory name prefix under os.tmpdir(), e.g. engram-extract. */
  prefix: string;
  /** Filename inside the temp dir, e.g. extract-context.json. */
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
  const workDir = join(tmpdir(), `${opts.prefix}-${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  try {
    const contextPath = join(workDir, opts.filename);
    await writeFile(contextPath, JSON.stringify(opts.value, null, 2), "utf8");
    return await fn(workDir, contextPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
