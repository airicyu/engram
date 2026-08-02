/** Shared post-spawn checks for AgentInvoker implementations. */

import { access } from "node:fs/promises";

/** Ensure each required deliverable path exists after a successful agent exit. */
export async function assertRequireFiles(paths: string[] | undefined): Promise<void> {
  if (!paths?.length) return;
  for (const path of paths) {
    try {
      await access(path);
    } catch {
      throw new Error(`agent finished but required file is missing: ${path}`);
    }
  }
}

/** Replace the prompt argv slot with a placeholder for safe logging. */
export function cmdForLog(cmd: string[]): string[] {
  const out = [...cmd];
  const pIdx = out.indexOf("-p");
  if (pIdx >= 0 && pIdx + 1 < out.length) {
    out[pIdx + 1] = "<prompt>";
  }
  return out;
}
