/**
 * 0.16 dream file pipeline: prepare draft workspace, scan disk → manifest,
 * apply ledger append sidecars, read deletes list.
 */

import { access, mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse, stringify } from "../../yaml";
import { homePath } from "../home";
import { draftDir } from "./dream-runs";
import { nowIso } from "../memories/activities";
import { dayLedgerPath } from "../memories/chain";
import type { DraftManifest, ManifestEntry, ManifestOp } from "./draft";
import { isForbiddenLegacyNodeRel } from "../../agent/shared/write-policy";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function draftRoot(dreamRunId: string): string {
  return draftDir(dreamRunId);
}

export function draftAbs(dreamRunId: string, ...parts: string[]): string {
  return join(draftRoot(dreamRunId), ...parts);
}

/** Wipe and create an empty draft workspace for a dream run. */
export async function prepareDreamDraft(dreamRunId: string): Promise<string> {
  const root = draftRoot(dreamRunId);
  await rm(root, { recursive: true, force: true });
  await mkdir(join(root, "memories"), { recursive: true });
  await mkdir(join(root, "appends"), { recursive: true });
  await writeFile(join(root, "deletes.txt"), "", "utf8");
  return root;
}

/** Write a file under draft (relative path must stay inside draft root). */
export async function writeDraftFile(
  dreamRunId: string,
  relPath: string,
  content: string,
): Promise<void> {
  const safe = assertSafeStoreRel(relPath);
  const dest = draftAbs(dreamRunId, ...safe.split("/"));
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

/** Copy a live store file into draft if it exists (for AI edit). */
export async function copyLiveIntoDraft(
  dreamRunId: string,
  relPath: string,
): Promise<boolean> {
  const safe = assertSafeStoreRel(relPath);
  const live = homePath(...safe.split("/"));
  if (!(await exists(live))) return false;
  const dest = draftAbs(dreamRunId, ...safe.split("/"));
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(live, dest);
  return true;
}

/** Reject `..` and non-memories paths for deletes / draft writes. */
export function assertSafeStoreRel(
  relPath: string,
  opts?: { allowLegacyNodePaths?: boolean },
): string {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!norm || norm.includes("\0")) {
    throw new Error(`invalid path: ${relPath}`);
  }
  if (norm.split("/").some((p) => p === ".." || p === "")) {
    throw new Error(`path escape rejected: ${relPath}`);
  }
  if (!norm.startsWith("memories/")) {
    throw new Error(`path must be under memories/: ${relPath}`);
  }
  // 0.28: refuse legacy node main-file locations (use memories/nodes/{id}/{id}.md).
  // Deletes may still list legacy paths to remove them from live after a bad draft.
  if (!opts?.allowLegacyNodePaths) {
    if (/^memories\/nodes\/[^/]+\/understand\/what\.md$/i.test(norm)) {
      throw new Error(`legacy node path rejected: ${relPath}`);
    }
    if (/^memories\/nodes\/[^/]+\/index\.md$/i.test(norm)) {
      throw new Error(`legacy stub INDEX rejected: ${relPath}`);
    }
  }
  return norm;
}

/** Read deletes.txt (one relative path per line; blank／# comments ignored). */
export async function readDraftDeletes(dreamRunId: string): Promise<string[]> {
  const p = draftAbs(dreamRunId, "deletes.txt");
  if (!(await exists(p))) return [];
  const text = await readFile(p, "utf8");
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    out.push(assertSafeStoreRel(t, { allowLegacyNodePaths: true }));
  }
  return [...new Set(out)].sort();
}

const LEDGER_APPEND_RE =
  /^memories\/chain\/days\/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}\.md$/;

/**
 * Apply `draft/appends/**` sidecars onto draft ledger files (copy live first if needed).
 * Sidecar relative path mirrors the live ledger path under `appends/`.
 * Each sidecar is **removed after a successful apply** so a later `finalizeDraftFromDisk`
 * (e.g. post-rollup) is idempotent and will not duplicate blocks.
 */
export async function applyAppendSidecars(dreamRunId: string): Promise<string[]> {
  const appendRoot = draftAbs(dreamRunId, "appends");
  if (!(await exists(appendRoot))) return [];
  const applied: string[] = [];
  const files = await listFilesRecursive(appendRoot);
  for (const abs of files) {
    const relFromAppends = relative(appendRoot, abs).split(sep).join("/");
    const storeRel = assertSafeStoreRel(relFromAppends);
    if (!LEDGER_APPEND_RE.test(storeRel) || storeRel.endsWith(".summary.md")) {
      throw new Error(`append sidecar not a day ledger path: ${storeRel}`);
    }
    const block = (await readFile(abs, "utf8")).trimEnd();
    if (!block.trim()) {
      await rm(abs, { force: true });
      continue;
    }

    const draftLedger = draftAbs(dreamRunId, ...storeRel.split("/"));
    let base = "";
    if (await exists(draftLedger)) {
      base = await readFile(draftLedger, "utf8");
    } else {
      const live = homePath(...storeRel.split("/"));
      if (await exists(live)) {
        base = await readFile(live, "utf8");
      }
    }
    const next = base.trim()
      ? `${base.trimEnd()}\n${block.endsWith("\n") ? block : `${block}\n`}`
      : block.endsWith("\n")
        ? block
        : `${block}\n`;
    await mkdir(dirname(draftLedger), { recursive: true });
    await writeFile(draftLedger, next, "utf8");
    await rm(abs, { force: true });
    applied.push(storeRel);
  }
  return applied;
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out.push(p);
    }
  }
  await walk(dir);
  return out;
}

async function listMemoriesRel(dreamRunId: string): Promise<string[]> {
  const memRoot = draftAbs(dreamRunId, "memories");
  if (!(await exists(memRoot))) return [];
  const absFiles = await listFilesRecursive(memRoot);
  const root = draftRoot(dreamRunId);
  return absFiles
    .map((abs) => relative(root, abs).split(sep).join("/"))
    .filter((r) => r.startsWith("memories/"))
    .sort();
}

/**
 * After agent work: apply appends, scan draft memories, write manifest.yaml.
 * Does not trust AI path lists.
 * 0.28: legacy node paths (`understand/what.md`, stub INDEX) are removed from draft
 * and omitted from the manifest so approve cannot deploy them.
 */
export async function finalizeDraftFromDisk(dreamRunId: string): Promise<DraftManifest> {
  await applyAppendSidecars(dreamRunId);

  const rels = await listMemoriesRel(dreamRunId);
  const entries: ManifestEntry[] = [];
  const seen = new Set<string>();

  for (const rel of rels) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (isForbiddenLegacyNodeRel(rel)) {
      const abs = draftAbs(dreamRunId, ...rel.split("/"));
      await rm(abs, { force: true });
      continue;
    }
    const live = homePath(...rel.split("/"));
    const op: ManifestOp = (await exists(live)) ? "update" : "create";
    entries.push({ op, path: rel });
  }

  const manifest: DraftManifest = {
    dream_run_id: dreamRunId,
    materialized_at: nowIso(),
    entries,
  };
  await writeFile(draftAbs(dreamRunId, "manifest.yaml"), stringify(manifest), "utf8");
  return manifest;
}

/** Upsert one path into an existing manifest (rollup writes). */
export async function upsertManifestEntry(
  dreamRunId: string,
  relPath: string,
): Promise<DraftManifest> {
  const safe = assertSafeStoreRel(relPath);
  if (isForbiddenLegacyNodeRel(safe)) {
    throw new Error(`legacy node path rejected: ${relPath}`);
  }
  const existingPath = draftAbs(dreamRunId, "manifest.yaml");
  let entries: ManifestEntry[] = [];
  if (await exists(existingPath)) {
    const raw = parse(await readFile(existingPath, "utf8")) as DraftManifest;
    entries = [...(raw.entries ?? [])];
  }
  const live = homePath(...safe.split("/"));
  const op: ManifestOp = (await exists(live)) ? "update" : "create";
  const idx = entries.findIndex((e) => e.path === safe);
  if (idx >= 0) entries[idx] = { op, path: safe };
  else entries.push({ op, path: safe });

  const manifest: DraftManifest = {
    dream_run_id: dreamRunId,
    materialized_at: nowIso(),
    entries,
  };
  await writeFile(existingPath, stringify(manifest), "utf8");
  return manifest;
}

/** Write a whole-file update under draft/memories and refresh manifest entry. */
export async function writeDraftMemoryFile(
  dreamRunId: string,
  relPath: string,
  content: string,
): Promise<void> {
  await writeDraftFile(dreamRunId, relPath, content);
  await upsertManifestEntry(dreamRunId, relPath);
}

/** Resolve absolute paths; ensure `candidate` is under `root`. */
export function assertPathUnderRoot(root: string, candidate: string): string {
  const resolvedRoot = resolve(root);
  const resolved = resolve(candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + sep)) {
    throw new Error(`path outside root: ${candidate}`);
  }
  return resolved;
}

/** Day ledger absolute live path helper for mock appends. */
export function liveDayLedgerAbs(dayId: string): string {
  return dayLedgerPath(dayId);
}
