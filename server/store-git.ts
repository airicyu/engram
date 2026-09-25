import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const GITIGNORE_ENSURE = [
  "jobs/",
  ".DS_Store",
  "Thumbs.db",
] as const;

export type StoreGitOp =
  | { op: "event"; id: string }
  | { op: "attachment"; id: string }
  | { op: "clarify-submit"; id: string }
  | { op: "clarify-dismiss"; id: string }
  | { op: "clarify-aside"; id: string }
  | { op: "distill"; id: string }
  | { op: "reset" }
  | { op: "future-sight" };

type GitRunResult = { status: number; stderr: string };

type GitRunner = (args: string[], cwd: string) => GitRunResult;

function defaultGitRunner(args: string[], cwd: string): GitRunResult {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 30_000 });
  return { status: r.status ?? 1, stderr: `${r.stderr ?? ""}${r.stdout ?? ""}`.trim() };
}

let gitRunner: GitRunner = defaultGitRunner;

/** Test hook: replace git subprocess (null restores default). */
export function setStoreGitRunnerForTests(runner: GitRunner | null) {
  gitRunner = runner ?? defaultGitRunner;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function gitignoreCoversJobs(content: string): boolean {
  return content
    .split("\n")
    .some((line) => {
      const t = line.trim();
      return t === "jobs/" || t === "jobs" || t.startsWith("jobs/");
    });
}

async function mergeStoreGitignore(storeDir: string): Promise<void> {
  const p = join(storeDir, ".gitignore");
  let content = "";
  try {
    content = await readFile(p, "utf8");
  } catch {
    /* new file */
  }
  const lines = content.length ? content.replace(/\n?$/, "\n").split("\n") : [];
  const body = lines.join("\n");
  const toAppend: string[] = [];
  if (!gitignoreCoversJobs(body)) toAppend.push("jobs/");
  for (const line of GITIGNORE_ENSURE) {
    if (line === "jobs/") continue;
    if (!body.split("\n").some((l) => l.trim() === line)) toAppend.push(line);
  }
  if (!toAppend.length) return;
  const prefix = content.length && !content.endsWith("\n") ? "\n" : content.length ? "" : "";
  const block = `${prefix}${toAppend.join("\n")}\n`;
  await writeFile(p, content + block, "utf8");
}

function ensureLocalGitIdentity(storeDir: string): void {
  const check = gitRunner(["config", "--get", "user.email"], storeDir);
  if (check.status !== 0) {
    gitRunner(["config", "user.email", "engram-lite@local"], storeDir);
    gitRunner(["config", "user.name", "engram-lite"], storeDir);
  }
}

export async function ensureStoreGit(storeDir: string): Promise<void> {
  await mkdir(storeDir, { recursive: true });
  await mergeStoreGitignore(storeDir);
  if (!(await exists(join(storeDir, ".git")))) {
    const init = gitRunner(["init"], storeDir);
    if (init.status !== 0) throw new Error(init.stderr || "git init failed");
    ensureLocalGitIdentity(storeDir);
  }
}

function formatCommitMessage(payload: StoreGitOp): string {
  switch (payload.op) {
    case "event":
      return `engram-lite: event ${payload.id}`;
    case "attachment":
      return `engram-lite: attachment ${payload.id}`;
    case "clarify-submit":
      return `engram-lite: clarify-submit ${payload.id}`;
    case "clarify-dismiss":
      return `engram-lite: clarify-dismiss ${payload.id}`;
    case "clarify-aside":
      return `engram-lite: clarify-aside ${payload.id}`;
    case "distill":
      return `engram-lite: distill ${payload.id}`;
    case "reset":
      return "engram-lite: reset";
    case "future-sight":
      return "engram-lite: future-sight maintain";
  }
}

/** Local-only store commit after successful vault write. Failures are logged only. */
export async function commitStore(
  storeDir: string,
  payload: StoreGitOp,
): Promise<{ warn?: string }> {
  try {
    await ensureStoreGit(storeDir);
    const add = gitRunner(["add", "-A"], storeDir);
    if (add.status !== 0) {
      const msg = `[store-git] git add failed: ${add.stderr}`;
      console.warn(msg);
      return { warn: msg };
    }
    const staged = gitRunner(["diff", "--cached", "--quiet"], storeDir);
    if (staged.status === 0) return {};
    const msg = formatCommitMessage(payload);
    const commit = gitRunner(["commit", "-m", msg], storeDir);
    if (commit.status !== 0) {
      const warn = `[store-git] git commit failed: ${commit.stderr}`;
      console.warn(warn);
      return { warn };
    }
    return {};
  } catch (err) {
    const warn = `[store-git] ${err instanceof Error ? err.message : String(err)}`;
    console.warn(warn);
    return { warn };
  }
}
