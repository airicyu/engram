/**
 * Offline Engram store → Engram Lite store import (0.4.0).
 * Read-only source; writes only under --to. Default: dry-run.
 */

import {
  access,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  canonicalWeekIdFromLegacy,
  isValidWeekId,
  weekMonthKey,
} from "../server/chain/time.ts";
import { normalizeAttachmentEmbedsInMarkdown } from "../server/markdown/embeds.ts";
import {
  mergeActivityScoreIntoMarkdown,
  parseActivityScoreFromYaml,
} from "../server/nodes/score.ts";
import { randomEventSuffix } from "../server/vault/index.ts";

export type ImportScope = {
  chain: boolean;
  nodes: boolean;
  attachments: boolean;
  futureSight: boolean;
  pool: boolean;
  workspace: boolean;
};

export type ImportOptions = {
  from: string;
  to: string;
  dryRun: boolean;
  force: boolean;
  scope: ImportScope;
};

export type ImportStats = {
  chainWritten: number;
  chainSkipped: number;
  nodesCopied: number;
  attachmentsCopied: number;
  futureSightCopied: number;
  poolRows: number;
  workspace: boolean;
};

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_ID = /^\d{4}-\d{2}$/;
const YEAR_ID = /^\d{4}$/;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function resolveStorePaths(from: string, to: string): { from: string; to: string } {
  return { from: resolve(from), to: resolve(to) };
}

export async function looksLikeEngramStore(root: string): Promise<boolean> {
  if (await exists(join(root, "engram.workspace.yaml"))) return true;
  const dreams = await exists(join(root, "dreams"));
  const memories = await exists(join(root, "memories"));
  return dreams && memories;
}

async function walkFiles(dir: string, acc: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** True if target vault has any real memory content (not just .gitkeep / empty pool). */
export async function targetVaultHasContent(toRoot: string): Promise<boolean> {
  const vault = join(toRoot, "memories");
  if (!(await exists(vault))) return false;
  const files = await walkFiles(vault);
  for (const f of files) {
    if (basename(f) === ".gitkeep") continue;
    if (f.endsWith("pending.jsonl") || f.endsWith("archived.jsonl")) {
      const t = (await readFile(f, "utf8")).trim();
      if (!t) continue;
      return true;
    }
    return true;
  }
  return false;
}

function chainIdFromSummaryBase(base: string): string | null {
  if (DAY_ID.test(base)) return base;
  if (MONTH_ID.test(base)) return base;
  if (YEAR_ID.test(base)) return base;
  const week = canonicalWeekIdFromLegacy(base) ?? (isValidWeekId(base) ? base : null);
  return week;
}

function liteChainPath(vault: string, id: string): string | null {
  if (DAY_ID.test(id)) {
    return join(vault, "chain", "days", id.slice(0, 7), `${id}.md`);
  }
  if (isValidWeekId(id)) {
    return join(vault, "chain", "weeks", weekMonthKey(id), `${id}.md`);
  }
  if (MONTH_ID.test(id)) {
    return join(vault, "chain", "months", id.slice(0, 4), `${id}.md`);
  }
  if (YEAR_ID.test(id)) {
    return join(vault, "chain", "years", `${id}.md`);
  }
  return null;
}

async function mergeNodeActivityScoresFromSidecars(nodesRoot: string): Promise<void> {
  let ids: string[];
  try {
    ids = await readdir(nodesRoot);
  } catch {
    return;
  }
  for (const id of ids) {
    const mdPath = join(nodesRoot, id, `${id}.md`);
    const scorePath = join(nodesRoot, id, "score.yaml");
    if (!(await exists(mdPath)) || !(await exists(scorePath))) continue;
    const yaml = await readFile(scorePath, "utf8");
    const score = parseActivityScoreFromYaml(yaml);
    if (score == null) continue;
    const md = await readFile(mdPath, "utf8");
    const next = mergeActivityScoreIntoMarkdown(md, score);
    if (next !== md) await writeFile(mdPath, next, "utf8");
  }
}

async function copyTreeIfMissing(
  src: string,
  dest: string,
  dryRun: boolean,
  force: boolean,
): Promise<number> {
  if (!(await exists(src))) return 0;
  if (await exists(dest)) {
    if (!force) return 0;
    // --force: only supplement — if dest exists, skip whole tree copy
    return 0;
  }
  if (dryRun) return 1;
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  return 1;
}

async function writeFileUnlessExists(
  dest: string,
  content: string,
  dryRun: boolean,
  force: boolean,
): Promise<"written" | "skipped" | "dry"> {
  if (await exists(dest)) {
    if (force) return "skipped";
    return "skipped";
  }
  if (dryRun) return "dry";
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, content, "utf8");
  return "written";
}

type PoolRow = { id?: string; ts?: string; raw?: string; note?: string; attachments?: unknown };

function ymdFromTs(ts: string): string {
  const d = ts.slice(0, 10).replace(/-/g, "");
  return /^\d{8}$/.test(d) ? d : "00000000";
}

function newEvtId(ymd: string, seen: Set<string>): string {
  let id = `evt_${ymd}_${randomEventSuffix()}`;
  for (let i = 0; i < 32 && seen.has(id); i++) id = `evt_${ymd}_${randomEventSuffix()}`;
  seen.add(id);
  return id;
}

export async function runImport(opts: ImportOptions): Promise<ImportStats> {
  const from = resolve(opts.from);
  const to = resolve(opts.to);
  const fromVault = join(from, "memories");
  const toVault = join(to, "memories");
  const dryRun = opts.dryRun;
  const force = opts.force;

  const stats: ImportStats = {
    chainWritten: 0,
    chainSkipped: 0,
    nodesCopied: 0,
    attachmentsCopied: 0,
    futureSightCopied: 0,
    poolRows: 0,
    workspace: false,
  };

  if (from === to) throw new Error("from and to must differ");
  if (!(await exists(fromVault))) throw new Error(`source missing memories/: ${fromVault}`);
  if (await looksLikeEngramStore(to)) {
    throw new Error("refusing --to that looks like an Engram store (use a new Lite store directory)");
  }
  const hasContent = await targetVaultHasContent(to);
  if (hasContent && !force) {
    throw new Error("target store already has memory content; use empty store or --force (supplement missing files only)");
  }

  if (opts.scope.chain) {
    const chainRoot = join(fromVault, "chain");
    const files = (await walkFiles(chainRoot)).filter((f) => f.endsWith(".summary.md"));
    for (const src of files) {
      const base = basename(src).replace(/\.summary\.md$/, "");
      const id = chainIdFromSummaryBase(base);
      if (!id) continue;
      const dest = liteChainPath(toVault, id);
      if (!dest) continue;
      const body = normalizeAttachmentEmbedsInMarkdown(await readFile(src, "utf8"));
      const rel = relative(to, dest);
      if (await exists(dest)) {
        stats.chainSkipped++;
        continue;
      }
      const w = await writeFileUnlessExists(dest, body, dryRun, force);
      if (w === "written" || w === "dry") stats.chainWritten++;
      else stats.chainSkipped++;
      if (dryRun && w === "dry") console.log(`[dry-run] chain → ${rel}`);
    }
  }

  if (opts.scope.nodes) {
    const destNodes = join(toVault, "nodes");
    const n = await copyTreeIfMissing(join(fromVault, "nodes"), destNodes, dryRun, force);
    stats.nodesCopied = n;
    if (dryRun && n) console.log("[dry-run] nodes/ → memories/nodes/");
    if (!dryRun && (await exists(destNodes))) {
      for (const mdPath of (await walkFiles(destNodes)).filter((f) => f.endsWith(".md"))) {
        const text = await readFile(mdPath, "utf8");
        const next = normalizeAttachmentEmbedsInMarkdown(text);
        if (next !== text) await writeFile(mdPath, next, "utf8");
      }
      await mergeNodeActivityScoresFromSidecars(destNodes);
    }
  }

  if (opts.scope.attachments) {
    const n = await copyTreeIfMissing(
      join(fromVault, "_attachments"),
      join(toVault, "_attachments"),
      dryRun,
      force,
    );
    stats.attachmentsCopied = n;
    if (dryRun && n) console.log("[dry-run] _attachments/ → memories/_attachments/");
  }

  if (opts.scope.futureSight) {
    const fsDir = join(fromVault, "future-sight");
    for (const name of ["upcoming.md", "longTerm.md"] as const) {
      const src = join(fsDir, name);
      if (!(await exists(src))) continue;
      const dest = join(toVault, "future-sight", name);
      if (await exists(dest)) continue;
      if (dryRun) {
        stats.futureSightCopied++;
        console.log(`[dry-run] future-sight/${name}`);
        continue;
      }
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      stats.futureSightCopied++;
    }
  }

  if (opts.scope.pool) {
    const srcPool = join(fromVault, "short-term-memory", "pool.jsonl");
    const destPool = join(toVault, "pool", "pending.jsonl");
    if (await exists(srcPool)) {
      const existing = (await exists(destPool)) ? await readFile(destPool, "utf8") : "";
      if (existing.trim() && !force) {
        /* skip pool when target pending already has rows */
      } else {
      const seen = new Set<string>();
      for (const line of existing.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const o = JSON.parse(t) as { id?: string };
          if (o.id) seen.add(o.id);
        } catch {
          /* ignore */
        }
      }
      const outLines: string[] = [];
      const srcText = await readFile(srcPool, "utf8");
      for (const line of srcText.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        let row: PoolRow;
        try {
          row = JSON.parse(t) as PoolRow;
        } catch {
          continue;
        }
        const raw = normalizeAttachmentEmbedsInMarkdown(typeof row.raw === "string" ? row.raw : "");
        const ts = typeof row.ts === "string" ? row.ts : new Date().toISOString();
        if (!raw.trim()) continue;
        const ymd = ymdFromTs(ts);
        const id = newEvtId(ymd, seen);
        const lite: Record<string, unknown> = { id, ts, raw };
        if (typeof row.note === "string" && row.note.trim()) lite.note = row.note;
        if (Array.isArray(row.attachments) && row.attachments.length) lite.attachments = row.attachments;
        outLines.push(JSON.stringify(lite));
        stats.poolRows++;
      }
      if (outLines.length) {
        const merged = existing.trim() ? existing.trimEnd() + "\n" + outLines.join("\n") + "\n" : outLines.join("\n") + "\n";
        if (dryRun) {
          console.log(`[dry-run] pool ${outLines.length} row(s) → memories/pool/pending.jsonl`);
        } else {
          await mkdir(dirname(destPool), { recursive: true });
          await writeFile(destPool, merged, "utf8");
        }
      }
      }
    }
  }

  if (opts.scope.workspace) {
    const srcWs = join(from, "engram.workspace.yaml");
    const destWs = join(to, "workspace.yaml");
    if (await exists(srcWs)) {
      if (await exists(destWs)) {
        /* skip if workspace already exists */
      } else {
        const text = await readFile(srcWs, "utf8");
        const lines: string[] = [];
        for (const key of [
          "timezone",
          "memory_language",
          "pi_model",
          "future_sight_window_days",
          "future_sight_upcoming_days",
        ]) {
          const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
          if (m) lines.push(`${key}: ${m[1]!.trim()}`);
        }
        if (!lines.some((l) => l.startsWith("timezone:"))) lines.push("timezone: Asia/Hong_Kong");
        if (!lines.some((l) => l.startsWith("memory_language:"))) lines.push("memory_language: zh-Hant");
        const out = lines.join("\n") + "\n";
        if (dryRun) {
          console.log("[dry-run] workspace.yaml");
          stats.workspace = true;
        } else {
          await writeFile(destWs, out, "utf8");
          stats.workspace = true;
        }
      }
    }
  }

  return stats;
}

function parseArgs(argv: string[]): ImportOptions {
  const scope: ImportScope = {
    chain: true,
    nodes: true,
    attachments: true,
    futureSight: true,
    pool: true,
    workspace: true,
  };
  let from = "";
  let to = "";
  let yes = false;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--from") from = argv[++i] ?? "";
    else if (a === "--to") to = argv[++i] ?? "";
    else if (a === "--yes") yes = true;
    else if (a === "--force") force = true;
    else if (a === "--dry-run") yes = false;
    else if (a === "--chain") scope.chain = true;
    else if (a === "--no-chain") scope.chain = false;
    else if (a === "--nodes") scope.nodes = true;
    else if (a === "--no-nodes") scope.nodes = false;
    else if (a === "--attachments") scope.attachments = true;
    else if (a === "--no-attachments") scope.attachments = false;
    else if (a === "--future-sight") scope.futureSight = true;
    else if (a === "--no-future-sight") scope.futureSight = false;
    else if (a === "--pool") scope.pool = true;
    else if (a === "--no-pool") scope.pool = false;
    else if (a === "--workspace") scope.workspace = true;
    else if (a === "--no-workspace") scope.workspace = false;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: bun run scripts/import-from-engram.ts --from <engram-store> --to <lite-store> [--yes] [--force] [--dry-run]

Default is dry-run. --yes writes files. --force allows non-empty target but only adds missing paths.
Pool ids are rewritten to evt_YYYYMMDD_xxxxxx.`);
      process.exit(0);
    }
  }
  if (!from || !to) {
    console.error("required: --from and --to");
    process.exit(1);
  }
  return { from, to, dryRun: !yes, force, scope };
}

if (import.meta.main) {
  const opts = parseArgs(process.argv.slice(2));
  runImport(opts)
    .then((stats) => {
      console.log(opts.dryRun ? "dry-run complete:" : "import complete:", stats);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
