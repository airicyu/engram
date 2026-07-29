/**
 * Store-local git ensure and helpers (0.16).
 * Always invoke as `git -C $ENGRAM_STORE_DIR …` — never rely on cwd walking up to the product repo.
 */

import { access, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";

export class StoreGitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreGitError";
  }
}

function storePath(...parts: string[]): string {
  return join(config.storeDir, ...parts);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** True when `git` binary is on PATH. */
export async function gitBinaryAvailable(): Promise<boolean> {
  const proc = Bun.spawn(["git", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  return code === 0;
}

export type GitRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/** Run `git -C <storeDir> …` with fixed author/committer for store commits. */
export async function gitInStore(
  args: string[],
  opts?: { allowNonZero?: boolean },
): Promise<GitRunResult> {
  const proc = Bun.spawn(["git", "-C", config.storeDir, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "engram",
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "engram@local",
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "engram",
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "engram@local",
    },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0 && !opts?.allowNonZero) {
    throw new StoreGitError(
      `git -C ${config.storeDir} ${args.join(" ")} failed (${code}): ${
        stderr.trim() || stdout.trim() || "(no output)"
      }`,
    );
  }
  return { code, stdout, stderr };
}

const GITIGNORE_LINES = ["tmp/", "dreams/", "log/"] as const;

/** Ensure `.gitignore` contains required exclusions (idempotent merge). */
export async function ensureStoreGitignore(): Promise<void> {
  const path = storePath(".gitignore");
  let existing = "";
  if (await exists(path)) {
    existing = await readFile(path, "utf8");
  }
  const lines = existing
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
  const have = new Set(lines.map((l) => l.trim()).filter(Boolean));
  let changed = !existing;
  for (const req of GITIGNORE_LINES) {
    if (!have.has(req)) {
      lines.push(req);
      have.add(req);
      changed = true;
    }
  }
  if (changed) {
    await writeFile(path, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  }
}

/**
 * Idempotent: require git binary; init store repo if needed; write `.gitignore`;
 * create initial commit when HEAD is missing.
 */
export async function ensureStoreGit(): Promise<void> {
  if (!(await gitBinaryAvailable())) {
    throw new StoreGitError(
      "git is required for the Engram store (0.16+). Install git, ensure it is on PATH, then restart.",
    );
  }

  const gitDir = storePath(".git");
  if (!(await exists(gitDir))) {
    await gitInStore(["init"]);
  }

  await ensureStoreGitignore();

  const head = await gitInStore(["rev-parse", "--verify", "HEAD"], {
    allowNonZero: true,
  });
  if (head.code === 0) {
    return;
  }

  // Initial commit: track memories + workspace + gitignore; dreams/tmp stay ignored.
  await gitInStore(["add", "-A"]);
  const status = await gitInStore(["status", "--porcelain"]);
  if (status.stdout.trim()) {
    await gitInStore(["commit", "-m", "engram: initial store"]);
  } else {
    await gitInStore(["commit", "--allow-empty", "-m", "engram: initial store"]);
  }
}

/** True when storeDir is a git work tree (after ensure, should always be). */
export async function isStoreGitReady(): Promise<boolean> {
  const r = await gitInStore(["rev-parse", "--is-inside-work-tree"], {
    allowNonZero: true,
  });
  return r.code === 0 && r.stdout.trim() === "true";
}

/** Whether path is tracked in the store repo at HEAD. */
export async function isPathTracked(relPath: string): Promise<boolean> {
  const r = await gitInStore(["ls-files", "--error-unmatch", "--", relPath], {
    allowNonZero: true,
  });
  return r.code === 0;
}

/**
 * Restore only the given relative paths to HEAD (or delete if untracked creates).
 * Never runs `git reset --hard`.
 */
export async function restoreTouchedPaths(relPaths: string[]): Promise<void> {
  const unique = [...new Set(relPaths)].filter(Boolean);
  for (const rel of unique) {
    if (await isPathTracked(rel)) {
      await gitInStore(["checkout", "HEAD", "--", rel]);
    } else {
      const abs = storePath(...rel.split("/"));
      if (await exists(abs)) {
        await rm(abs, { force: true, recursive: true });
      }
    }
  }
}

/**
 * Stage and commit only the listed paths. No-op if nothing staged changes.
 * Returns true if a commit was created.
 */
export async function stageAndCommitPaths(
  relPaths: string[],
  message: string,
): Promise<boolean> {
  const unique = [...new Set(relPaths)].filter(Boolean);
  if (unique.length === 0) return false;
  await gitInStore(["add", "--", ...unique]);
  const st = await gitInStore(["diff", "--cached", "--name-only"]);
  if (!st.stdout.trim()) return false;
  await gitInStore(["commit", "-m", message]);
  return true;
}

/**
 * Commit any already-dirty tracked memories／workspace before a dream deploy,
 * so failure rollback cannot confuse unrelated L0／short-term writes.
 */
export async function commitDirtyMemorySnapshot(message: string): Promise<boolean> {
  await gitInStore(["add", "-A", "--", "memories", "engram.workspace.yaml", ".gitignore"], {
    allowNonZero: true,
  });
  const st = await gitInStore(["diff", "--cached", "--name-only"]);
  if (!st.stdout.trim()) return false;
  await gitInStore(["commit", "-m", message]);
  return true;
}
