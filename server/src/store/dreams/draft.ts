/** Inspect and atomically commit isolated dream draft projections. */

import { access, copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homePath } from "../home";
import { draftDir } from "./dream-runs";
import { extractCurrentSection } from "../memories/nodes";
import { listDraftFutureIds } from "../memories/future-sight";
import { restoreTouchedPaths } from "../git";
import { daySummaryRel } from "../memories/chain";
import { higherSummaryRel, type HigherChainLevel } from "../memories/chain-higher";

/** Operation represented by a draft manifest entry. */
export type ManifestOp = "create" | "update";

/** One live-store path changed by a draft. */
export interface ManifestEntry {
  op: ManifestOp;
  path: string;
}

/** Files materialized for a dream run before approval. */
export interface DraftManifest {
  dream_run_id: string;
  materialized_at: string;
  entries: ManifestEntry[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function livePath(...parts: string[]): string {
  return homePath(...parts);
}

function draftPath(dreamRunId: string, ...parts: string[]): string {
  return join(draftDir(dreamRunId), ...parts);
}

function manifestPath(dreamRunId: string): string {
  return draftPath(dreamRunId, "manifest.yaml");
}

/** Prefer draft, then live, for day summary body (week rollup). */
export async function readDaySummaryPreferDraft(dreamRunId: string, dayId: string): Promise<string> {
  const rel = daySummaryRel(dayId);
  for (const root of [draftDir(dreamRunId), homePath()]) {
    const path = join(root, ...rel.split("/"));
    if (await exists(path)) return extractCurrentSection(await readFile(path, "utf8"));
  }
  return "";
}

/** Prefer draft, then live, for higher summary Current (rollup cascade). */
export async function readHigherSummaryCurrentPreferDraft(
  dreamRunId: string,
  level: HigherChainLevel,
  id: string,
): Promise<string> {
  const rel = higherSummaryRel(level, id);
  for (const root of [draftDir(dreamRunId), homePath()]) {
    const path = join(root, ...rel.split("/"));
    if (await exists(path)) return extractCurrentSection(await readFile(path, "utf8"));
  }
  return "";
}

/** Read the materialization manifest for a dream run. */
export async function readManifest(dreamRunId: string): Promise<DraftManifest | null> {
  const p = manifestPath(dreamRunId);
  if (!(await exists(p))) return null;
  const { parse } = await import("../../yaml");
  return parse(await readFile(p, "utf8")) as DraftManifest;
}

/** Deploy draft → live, rolling back only paths touched by this call on failure. */
export async function commitDraft(dreamRunId: string): Promise<{ committed: string[] }> {
  const manifest = await readManifest(dreamRunId);
  if (!manifest) throw new Error(`no manifest for draft ${dreamRunId}`);
  const committed: string[] = [];
  const touched: string[] = [];
  const deletes = await readDraftDeletes(dreamRunId);
  try {
    for (const rel of deletes) {
      const dest = livePath(...rel.split("/"));
      if (await exists(dest)) {
        await rm(dest, { force: true });
        touched.push(rel);
      }
      committed.push(rel);
    }
    for (const entry of manifest.entries) {
      const src = draftPath(dreamRunId, ...entry.path.split("/"));
      const dest = livePath(...entry.path.split("/"));
      if (!(await exists(src))) throw new Error(`draft missing file: ${entry.path}`);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      committed.push(entry.path);
      touched.push(entry.path);
    }
  } catch (e) {
    await restoreTouchedPaths(touched).catch(() => {});
    throw e;
  }
  return { committed: [...new Set(committed)] };
}

/** Read validated delete paths from a draft. */
export async function readDraftDeletes(dreamRunId: string): Promise<string[]> {
  const p = draftPath(dreamRunId, "deletes.txt");
  if (!(await exists(p))) return [];
  const out: string[] = [];
  for (const line of (await readFile(p, "utf8")).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const norm = t.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!norm.startsWith("memories/") || norm.split("/").includes("..")) {
      throw new Error(`invalid delete path: ${t}`);
    }
    out.push(norm);
  }
  return [...new Set(out)];
}

/** Summarize the paths and memory domains represented in a draft. */
export async function draftSummary(dreamRunId: string): Promise<{
  entry_count: number;
  chain_days: string[];
  chain_summary_days: string[];
  chain_weeks: string[];
  chain_months: string[];
  chain_years: string[];
  future_ids: string[];
} | null> {
  const manifest = await readManifest(dreamRunId);
  if (!manifest) return null;
  const paths = manifest.entries.map((e) => e.path);
  const ids = (regex: RegExp) => paths.map((path) => path.match(regex)?.[1]).filter((id): id is string => !!id).sort();
  const touchedFuture = paths.some((path) => path === "memories/future-sight/hot.md" || path === "memories/future-sight/later.md");
  return {
    entry_count: manifest.entries.length,
    chain_days: [...new Set(ids(/^memories\/chain\/days\/\d{4}-\d{2}\/(\d{4}-\d{2}-\d{2})\.md$/))],
    chain_summary_days: [...new Set(ids(/^memories\/chain\/days\/\d{4}-\d{2}\/(\d{4}-\d{2}-\d{2})\.summary\.md$/))],
    chain_weeks: [...new Set(ids(/^memories\/chain\/weeks\/\d{4}-\d{2}\/(\d{4}-W\d{2})\.summary\.md$/))],
    chain_months: [...new Set(ids(/^memories\/chain\/months\/\d{4}\/(\d{4}-\d{2})\.summary\.md$/))],
    chain_years: [...new Set(ids(/^memories\/chain\/years\/(\d{4})\.summary\.md$/))],
    future_ids: touchedFuture ? await listDraftFutureIds(draftDir(dreamRunId)) : [],
  };
}

/** List relative paths under a draft (debug). */
export async function listDraftFiles(dreamRunId: string): Promise<string[]> {
  const root = draftDir(dreamRunId);
  if (!(await exists(root))) return [];
  const out: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else out.push(rel);
    }
  }
  await walk(root, "");
  return out;
}
