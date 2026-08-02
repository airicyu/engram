/** Generic agent job contract (0.20 Phase 7). Deliverable is on disk; stdout is not truth. */

import type { WritePolicy } from "../shared/write-policy";

/** One spawn. Domain has already rendered the prompt and chosen write roots. */
export type AgentJob = {
  processKey: string;
  prompt: string;
  cwd: string;
  writePolicy: WritePolicy;
  onPid?: (pid: number) => void | Promise<void>;
  /** After process exits 0: each path must exist or run() throws. */
  requireFiles?: string[];
  /**
   * Extra Cursor `--add-dir` entries for Read (e.g. store root for Ask).
   * Not treated as writable roots.
   */
  cursorExtraAddDirs?: string[];
  exitErrorLabel?: string;
  /** Optional context for spawn／result logs (e.g. dream_run_id, job_id). */
  logMeta?: Record<string, unknown>;
};

/** Provider that turns an AgentJob into a CLI spawn + requireFiles check. */
export interface AgentInvoker {
  run(job: AgentJob): Promise<void>;
}
