/**
 * Mechanical Engram store migrate: 0.15 disk shape → 0.16.
 *
 * Usage:
 *   # from this skill directory:
 *   bun ./scripts/migrate-0.15-to-0.16.ts /abs/path/to/store
 *
 * Does NOT backup (caller／skill must backup first).
 * Does NOT replay dreams or rewrite patches.jsonl history.
 */

import { access, readdir, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import {
  upgradeLegacyWeekId,
  weekMonthKey,
} from "../../../../server/src/store/memories/chain-time.ts";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";

const TARGET_STORE_VERSION = "0.16.0";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dir: string, pred: (name: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  if (!(await exists(dir))) return out;
  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (pred(e.name)) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

/** Peel ## Current … ## History → whole-file body (0.16). */
export function reshapeNarrativeFile(md: string): string {
  const hasCurrent = /^##\s*Current\b/m.test(md);
  let body: string;
  if (hasCurrent) {
    const match = md.match(/##\s*Current\s*\n([\s\S]*?)(?=\n##\s*History\b|$)/);
    body = match ? match[1] : md;
  } else {
    const beforeHistory = md.match(/^([\s\S]*?)(?=\n##\s*History\b|$)/);
    body = beforeHistory ? beforeHistory[1] : md;
  }
  return `${body.trim()}\n`;
}

/** Strip leading `# YYYY-MM-DD` title from day ledger. */
export function reshapeLedgerFile(md: string, dayIdFromName?: string): string {
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (i >= lines.length) return md.endsWith("\n") ? md : `${md}\n`;
  const first = lines[i]!.trim();
  const m = first.match(/^#\s+(\d{4}-\d{2}-\d{2})\s*$/);
  if (m) {
    // Drop date heading (filename day is advisory; any # YYYY-MM-DD top title is removed)
    void dayIdFromName;
    lines.splice(i, 1);
    if (i < lines.length && lines[i]!.trim() === "") {
      lines.splice(i, 1);
    }
  }
  let out = lines.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

async function git(storeDir: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", "-C", storeDir, ...args], {
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
  return { code, stdout, stderr };
}

async function ensureGitignore(storeDir: string): Promise<void> {
  const path = join(storeDir, ".gitignore");
  let existing = "";
  if (await exists(path)) existing = await readFile(path, "utf8");
  const lines = existing
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
  // Drop leading empty lines from a previously empty file
  while (lines.length && lines[0] === "") lines.shift();
  const have = new Set(lines.map((l) => l.trim()).filter(Boolean));
  for (const req of ["tmp/", "dreams/", "log/"]) {
    if (!have.has(req)) lines.push(req);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

/** Rename `YYYY-Www.summary.md` → `YYYY-Www-MMDD.summary.md` (Monday); update initialized_weeks.yaml. */
export async function renameLegacyWeekIds(storeDir: string): Promise<{ files: number; initialized: number }> {
  const root = resolve(storeDir);
  const weeksRoot = join(root, "memories", "chain", "weeks");
  let files = 0;
  for (const p of await walkFiles(weeksRoot, (n) => /^\d{4}-W\d{2}\.summary\.md$/.test(n))) {
    const legacy = p.split(/[/\\]/).pop()!.replace(/\.summary\.md$/, "");
    const next = upgradeLegacyWeekId(legacy);
    if (!next) continue;
    const destDir = join(weeksRoot, weekMonthKey(next));
    await mkdir(destDir, { recursive: true });
    const dest = join(destDir, `${next}.summary.md`);
    if (resolve(dest) === resolve(p)) continue;
    if (await exists(dest)) {
      // Canonical already present — drop legacy duplicate after backup? leave both; skip rename.
      continue;
    }
    await rename(p, dest);
    files++;
    // prune empty parent month dir (best-effort)
    try {
      const parent = dirname(p);
      const left = await readdir(parent);
      if (left.length === 0) {
        // leave empty dir; avoid rmdir surprise
      }
    } catch {
      /* ignore */
    }
  }

  let initialized = 0;
  const initPath = join(root, "memories", "chain", "initialized_weeks.yaml");
  if (await exists(initPath)) {
    const before = await readFile(initPath, "utf8");
    const after = before.replace(/^(\s*-\s*)(\d{4}-W\d{2})\s*$/gm, (full, prefix: string, id: string) => {
      const u = upgradeLegacyWeekId(id);
      if (!u) return full;
      initialized++;
      return `${prefix}${u}`;
    });
    if (after !== before) await writeFile(initPath, after, "utf8");
  }
  return { files, initialized };
}

/** Merge／set `store_version` on engram.workspace.yaml (creates file if missing). */
export async function stampStoreVersion(
  storeDir: string,
  version: string = TARGET_STORE_VERSION,
): Promise<boolean> {
  const path = join(resolve(storeDir), "engram.workspace.yaml");
  let doc: Record<string, unknown> = {};
  let header = "# Engram workspace preferences (per memory store)\n";
  if (await exists(path)) {
    const raw = await readFile(path, "utf8");
    const commentLines = raw.split(/\r?\n/).filter((l) => l.trimStart().startsWith("#"));
    if (commentLines.length) header = `${commentLines.join("\n")}\n`;
    try {
      const parsed = parseYaml(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        doc = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      /* keep empty doc; overwrite with stamp */
    }
  }
  if (doc.store_version === version) return false;
  doc.store_version = version;
  await writeFile(path, `${header}${stringifyYaml(doc)}`, "utf8");
  return true;
}

export async function migrateStore015to016(storeDir: string): Promise<{
  summaries: number;
  whats: number;
  ledgers: number;
  weeksRenamed: number;
  weeksInitializedUpdated: number;
  storeVersionStamped: boolean;
  gitInited: boolean;
  committed: boolean;
}> {
  const root = resolve(storeDir);
  if (!(await exists(join(root, "memories"))) && !(await exists(join(root, "engram.workspace.yaml")))) {
    throw new Error(`not an Engram store: ${root}`);
  }

  const daysRoot = join(root, "memories", "chain", "days");
  const nodesRoot = join(root, "memories", "nodes");

  let summaries = 0;
  let whats = 0;
  let ledgers = 0;

  for (const p of await walkFiles(daysRoot, (n) => n.endsWith(".summary.md"))) {
    const before = await readFile(p, "utf8");
    const after = reshapeNarrativeFile(before);
    if (after !== before) {
      await writeFile(p, after, "utf8");
      summaries++;
    }
  }

  for (const p of await walkFiles(nodesRoot, (n) => n === "what.md")) {
    if (!p.replace(/\\/g, "/").includes("/understand/what.md")) continue;
    const before = await readFile(p, "utf8");
    const after = reshapeNarrativeFile(before);
    if (after !== before) {
      await writeFile(p, after, "utf8");
      whats++;
    }
  }

  for (const p of await walkFiles(daysRoot, (n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))) {
    const base = p.split(/[/\\]/).pop()!.replace(/\.md$/, "");
    const before = await readFile(p, "utf8");
    const after = reshapeLedgerFile(before, base);
    if (after !== before) {
      await writeFile(p, after, "utf8");
      ledgers++;
    }
  }

  const weekRename = await renameLegacyWeekIds(root);
  const storeVersionStamped = await stampStoreVersion(root, TARGET_STORE_VERSION);

  // git
  const ver = Bun.spawn(["git", "--version"], { stdout: "pipe", stderr: "pipe" });
  if ((await ver.exited) !== 0) {
    throw new Error("git is required for 0.16 store migrate");
  }

  let gitInited = false;
  if (!(await exists(join(root, ".git")))) {
    const r = await git(root, ["init"]);
    if (r.code !== 0) throw new Error(`git init failed: ${r.stderr}`);
    gitInited = true;
  }

  await ensureGitignore(root);

  await git(root, ["add", "-A", "--", ".gitignore", "memories", "engram.workspace.yaml"]);
  if (await exists(join(root, "engram.workspace.yaml"))) {
    await git(root, ["add", "--", "engram.workspace.yaml"]);
  }

  let committed = false;
  const head = await git(root, ["rev-parse", "--verify", "HEAD"]);
  const porcelain = await git(root, ["status", "--porcelain"]);
  if (head.code !== 0) {
    if (porcelain.stdout.trim()) {
      const c = await git(root, ["commit", "-m", "engram: migrate store 0.15 → 0.16"]);
      if (c.code !== 0) throw new Error(`git commit failed: ${c.stderr}`);
      committed = true;
    } else {
      const c = await git(root, ["commit", "--allow-empty", "-m", "engram: migrate store 0.15 → 0.16"]);
      if (c.code !== 0) throw new Error(`git commit failed: ${c.stderr}`);
      committed = true;
    }
  } else if (porcelain.stdout.trim()) {
    const c = await git(root, ["commit", "-m", "engram: migrate store 0.15 → 0.16"]);
    if (c.code !== 0) throw new Error(`git commit failed: ${c.stderr}`);
    committed = true;
  }

  return {
    summaries,
    whats,
    ledgers,
    weeksRenamed: weekRename.files,
    weeksInitializedUpdated: weekRename.initialized,
    storeVersionStamped,
    gitInited,
    committed,
  };
}

async function main() {
  const storeDir = process.argv[2];
  if (!storeDir) {
    console.error("Usage: bun migrate-0.15-to-0.16.ts /abs/path/to/ENGRAM_STORE_DIR");
    process.exit(1);
  }
  const result = await migrateStore015to016(storeDir);
  console.log(JSON.stringify({ ok: true, store: resolve(storeDir), ...result }, null, 2));
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
