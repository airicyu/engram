/** Structured logging helpers for agent-based dream extraction. */

import type { Patch } from "../dream/schema";
import { logDream, logDreamDebug, previewText } from "../log";

/** Shared identifiers attached to an agent extraction log entry. */
export interface AgentExtractLogContext {
  dream_run_id: string;
  runner: string;
  work_dir: string;
}

/** Log the size and shape of an extraction context. */
export function logExtractContext(ctx: {
  dream_run_id: string;
  events: number;
  l1_chars: number;
  node_notes: number;
  existing_nodes: number;
  l2_nodes: number;
}): void {
  logDream("extract context", ctx);
}

/** Return a compact comma-separated description of extracted patches. */
export function summarizePatches(patches: Patch[]): string {
  return patches.map((p) => `${p.patch_id}:${p.type}`).join(", ");
}

/** Log an agent command before it starts. */
export function logAgentSpawn(meta: AgentExtractLogContext & { cmd: string[] }): void {
  logDreamDebug("agent spawn", {
    dream_run_id: meta.dream_run_id,
    runner: meta.runner,
    work_dir: meta.work_dir,
    cmd: meta.cmd.join(" "),
  });
}

/** Log an agent process result with safe output previews. */
export function logAgentResult(
  meta: AgentExtractLogContext,
  result: {
    exit_code: number;
    duration_ms: number;
    stdout: string;
    stderr: string;
  },
): void {
  logDreamDebug("agent finished", {
    dream_run_id: meta.dream_run_id,
    runner: meta.runner,
    work_dir: meta.work_dir,
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
    stdout_preview: previewText(result.stdout),
    stderr_preview: result.stderr ? previewText(result.stderr) : undefined,
  });
}

/** Log successfully parsed patches from agent output. */
export function logExtractParsed(
  dream_run_id: string,
  patches: Patch[],
): void {
  logDream("extract parsed", {
    dream_run_id,
    patches: patches.length,
    types: summarizePatches(patches),
  });
}

/** Log details of an agent output parsing failure. */
export function logExtractParseFailed(
  dream_run_id: string,
  runner: string,
  stdout: string,
  err: unknown,
): void {
  logDreamDebug("extract parse failed", {
    dream_run_id,
    runner,
    error: err instanceof Error ? err.message : String(err),
    stdout_bytes: stdout.length,
    stdout_preview: previewText(stdout, 800),
  });
}
