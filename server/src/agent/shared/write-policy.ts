/**
 * Agent write policy (0.20): approve 前不可寫 live memories／workspace／.git。
 * Runners must build CLI flags from this module; mock writes go through assertWritablePath.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { DreamContext } from "../dream/types";
import type { AskInput } from "../ask/types";
import { askJobDir } from "../../store/tmp/ask-job";

/** Absolute roots an agent may Write／Edit under (and may Read). */
export type WritePolicy = {
  /** Absolute ENGRAM_STORE_DIR (readable; not writable as a whole). */
  storeDir: string;
  /** Absolute directories where Write／Edit is allowed. */
  writableRoots: string[];
  /** Absolute directories where Read is expected (store + writable + extras). */
  readableRoots: string[];
};

function normRoot(p: string): string {
  return resolve(p);
}

/** True if `path` is exactly `root` or a path under it. */
export function isPathInsideRoot(path: string, root: string): boolean {
  const abs = resolve(path);
  const r = normRoot(root);
  if (abs === r) return true;
  const prefix = r.endsWith(sep) ? r : r + sep;
  return abs.startsWith(prefix);
}

/** True if path is under any writable root. */
export function isWritablePath(policy: WritePolicy, path: string): boolean {
  return policy.writableRoots.some((root) => isPathInsideRoot(path, root));
}

/** Reject writes outside policy (used by mock runners and tests). */
export function assertWritablePath(policy: WritePolicy, path: string): void {
  if (!isWritablePath(policy, path)) {
    throw new Error(
      `write_policy_denied: ${resolve(path)} is outside writable roots [${policy.writableRoots.join(", ")}]`,
    );
  }
}

/** mkdir + writeFile only if path is allowed. */
export async function guardedWriteFile(
  policy: WritePolicy,
  path: string,
  content: string,
): Promise<void> {
  assertWritablePath(policy, path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

/** Dream extract: draft tree + reports dir (+ optional temp workdir). */
export function dreamWritePolicy(
  ctx: DreamContext,
  extraWritable: string[] = [],
): WritePolicy {
  const storeDir = normRoot(ctx.store_dir);
  const draftDir = normRoot(ctx.draft_dir);
  const reportsDir = normRoot(dirname(ctx.report_path));
  const writableRoots = uniqueRoots([draftDir, reportsDir, ...extraWritable.map(normRoot)]);
  return {
    storeDir,
    writableRoots,
    readableRoots: uniqueRoots([storeDir, ...writableRoots]),
  };
}

/** Ask: only the job workspace may be written (result.json). Store is read-only. */
export function askWritePolicy(input: AskInput): WritePolicy {
  const storeDir = normRoot(input.store_dir);
  const jobDir = normRoot(askJobDir(input.job_id));
  return {
    storeDir,
    writableRoots: [jobDir],
    readableRoots: uniqueRoots([storeDir, jobDir]),
  };
}

/** Rollup plan: temp workdir only. Rollup write: draft (+ workdir). */
export function rollupWritePolicy(opts: {
  storeDir: string;
  workDir: string;
  /** When writing summaries into draft; omit for plan-only. */
  draftDir?: string;
}): WritePolicy {
  const storeDir = normRoot(opts.storeDir);
  const workDir = normRoot(opts.workDir);
  const writableRoots = uniqueRoots([
    workDir,
    ...(opts.draftDir ? [normRoot(opts.draftDir)] : []),
  ]);
  return {
    storeDir,
    writableRoots,
    readableRoots: uniqueRoots([storeDir, ...writableRoots]),
  };
}

function uniqueRoots(roots: string[]): string[] {
  const out: string[] = [];
  for (const r of roots) {
    const n = normRoot(r);
    if (!out.some((x) => x === n)) out.push(n);
  }
  return out;
}

/**
 * Claude Code `--allowedTools` value: Read everywhere needed; Edit only under writable roots.
 * Bash is omitted (0.20: no shell escape hatch to rewrite live store).
 * Path form uses Claude absolute rules: Edit(//{abs}/**).
 */
export function claudeAllowedToolsForWrites(policy: WritePolicy): string {
  const edits = policy.writableRoots.map((root) => {
    const abs = root.replace(/\\/g, "/");
    return `Edit(//${abs}/**)`;
  });
  return ["Read", ...edits].join(",");
}

/** Claude `--disallowedTools` — block Bash (and bare Write if Edit handles writes). */
export function claudeDisallowedTools(): string {
  return "Bash";
}

/**
 * Cursor `--add-dir` list for write-capable roots only (do not pass whole store for yolo).
 * Callers may separately add store for read when sandbox can confine writes.
 */
export function cursorWritableAddDirs(policy: WritePolicy): string[] {
  return [...policy.writableRoots];
}

/** Human-readable summary for prompts / logs. */
export function formatWritableRoots(policy: WritePolicy): string {
  return policy.writableRoots.join("\n- ");
}

/** Live memories path that must never be agent-writable before approve. */
export function liveMemoriesRoot(storeDir: string): string {
  return join(normRoot(storeDir), "memories");
}
