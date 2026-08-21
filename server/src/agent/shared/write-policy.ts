/**
 * Agent write policy (0.20): approve 前不可寫 live memories／workspace／.git。
 * Runners must build CLI flags from this module; mock writes go through assertWritablePath.
 */

import { existsSync } from "node:fs";
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
  /** Absolute files／dirs dream／distill／rollup must not Read (Ask leaves this empty). */
  deniedReadPrefixes?: string[];
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

/**
 * Legacy node narrative paths as store-relative strings (0.28).
 * - `memories/nodes/{id}/understand/what.md`
 * - `memories/nodes/{id}/INDEX.md`／`index.md`
 */
export function isForbiddenLegacyNodeRel(rel: string): boolean {
  const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (/^memories\/nodes\/[^/]+\/understand\/what\.md$/i.test(norm)) return true;
  if (/^memories\/nodes\/[^/]+\/index\.md$/i.test(norm)) return true;
  return false;
}

/**
 * Legacy node narrative paths (pre-0.28) that must not be written even under draft.
 * Accepts absolute or store-relative paths.
 */
export function isForbiddenLegacyNodePath(path: string): boolean {
  const asRel = path.replace(/\\/g, "/");
  if (isForbiddenLegacyNodeRel(asRel)) return true;
  const norm = resolve(path).replace(/\\/g, "/");
  if (/\/memories\/nodes\/[^/]+\/understand\/what\.md$/i.test(norm)) return true;
  if (/\/memories\/nodes\/[^/]+\/index\.md$/i.test(norm)) return true;
  return false;
}

/** True if path is under any writable root and not a forbidden legacy node path. */
export function isWritablePath(policy: WritePolicy, path: string): boolean {
  if (isForbiddenLegacyNodePath(path)) return false;
  return policy.writableRoots.some((root) => isPathInsideRoot(path, root));
}

/** Reject writes outside policy (used by mock runners and tests). */
export function assertWritablePath(policy: WritePolicy, path: string): void {
  if (isForbiddenLegacyNodePath(path)) {
    throw new Error(
      `write_policy_denied: ${resolve(path)} is a forbidden legacy node path (use memories/nodes/{id}/{id}.md)`,
    );
  }
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

/** Paths needed to fence dream／amend writes (draft + report). */
export type DreamWriteRoots = Pick<DreamContext, "store_dir" | "draft_dir" | "report_path">;

/** Dream extract／amend: draft tree + reports dir (+ optional temp workdir). */
export function dreamWritePolicy(
  ctx: DreamWriteRoots,
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
    deniedReadPrefixes: dreamDeniedReadPrefixes(storeDir),
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
    deniedReadPrefixes: dreamDeniedReadPrefixes(storeDir),
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

/** Live pool／L0／clarify pending — frozen input lives in context JSON／input.json. */
export function dreamDeniedReadPrefixes(storeDir: string): string[] {
  const store = normRoot(storeDir);
  return [
    join(store, "memories", "short-term-memory", "pool.jsonl"),
    join(store, "memories", "activities", "events.jsonl"),
    join(store, "memories", "clarify", "pending"),
  ];
}

/** True if path is a denied live input file for dream／distill／rollup. */
export function isDeniedReadPath(policy: WritePolicy, path: string): boolean {
  const prefixes = policy.deniedReadPrefixes ?? [];
  const abs = resolve(path);
  return prefixes.some((p) => isPathInsideRoot(abs, p) || abs === resolve(p));
}

export function isReadablePath(policy: WritePolicy, path: string): boolean {
  if (isDeniedReadPath(policy, path)) return false;
  return policy.readableRoots.some((root) => isPathInsideRoot(path, root));
}

export function assertReadablePath(policy: WritePolicy, path: string): void {
  if (!isReadablePath(policy, path)) {
    throw new Error(`read_policy_denied: ${resolve(path)}`);
  }
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
export function claudeDisallowedTools(policy?: WritePolicy): string {
  const parts = ["Bash"];
  for (const p of policy?.deniedReadPrefixes ?? []) {
    const abs = p.replace(/\\/g, "/");
    parts.push(`Read(//${abs})`);
    parts.push(`Read(//${abs}/**)`);
  }
  return parts.join(",");
}

/**
 * Cursor `--add-dir` list for write-capable roots only (do not pass whole store for yolo).
 * Callers may separately add store for read when sandbox can confine writes.
 */
export function cursorWritableAddDirs(policy: WritePolicy): string[] {
  return [...policy.writableRoots];
}

/** Absolute `{storeDir}/dreams` — Codex dream／rollup `--cd` when staging writes apply. */
export function storeDreamsRoot(storeDir: string): string {
  return join(normRoot(storeDir), "dreams");
}

/**
 * Codex `--cd` root (0.23): narrow fence for apply_patch.
 * Prefer `{store}/dreams` when any writable root lives under it (never the whole store).
 * Otherwise the sole／first writable root (Ask jobDir or rollup temp-only).
 */
export function codexCdRoot(policy: WritePolicy): string {
  if (policy.writableRoots.length === 0) {
    throw new Error("codexCdRoot: writePolicy.writableRoots is empty");
  }
  const dreams = storeDreamsRoot(policy.storeDir);
  if (policy.writableRoots.some((root) => isPathInsideRoot(root, dreams))) {
    return dreams;
  }
  return normRoot(policy.writableRoots[0]!);
}

/**
 * Codex `--add-dir` entries: writable roots not already inside／equal to `--cd`.
 * Does not include storeDir (read-only).
 */
export function codexAddDirs(policy: WritePolicy): string[] {
  const cd = codexCdRoot(policy);
  return policy.writableRoots
    .map(normRoot)
    .filter((root) => root !== cd && !isPathInsideRoot(root, cd));
}

/**
 * True when Codex should pass `--skip-git-repo-check`
 * (no `.git` found walking up from `--cd`).
 */
export function codexNeedsSkipGitRepoCheck(cdRoot: string): boolean {
  let cur = resolve(cdRoot);
  for (;;) {
    if (existsSync(join(cur, ".git"))) return false;
    const parent = dirname(cur);
    if (parent === cur) return true;
    cur = parent;
  }
}

/** Human-readable summary for prompts / logs. */
export function formatWritableRoots(policy: WritePolicy): string {
  return policy.writableRoots.join("\n- ");
}

/** Live memories path that must never be agent-writable before approve. */
export function liveMemoriesRoot(storeDir: string): string {
  return join(normRoot(storeDir), "memories");
}
