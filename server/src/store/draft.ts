import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify } from "yaml";
import { homePath } from "./home";
import { draftDir } from "./dream-runs";
import { taipeiDate, taipeiNowIso } from "./events";
import type { Patch } from "../dream/schema";
import { extractCurrentSection } from "./nodes";
import { logDream, logDreamDebug } from "../log";
import { renderFutureSightMarkdown, type FutureSightAnchor } from "./future-sight";

export type ManifestOp = "create" | "update";

export interface ManifestEntry {
  op: ManifestOp;
  path: string; // relative to ENGRAM_HOME
}

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

/** Collect future chain.id values (Asia/Taipei calendar day > today). */
export function futureChainIds(patches: Patch[], today = taipeiDate()): string[] {
  const out: string[] = [];
  for (const p of patches) {
    if (p.type === "chain" && p.id > today) {
      out.push(p.id);
    }
  }
  return [...new Set(out)].sort();
}

async function liveNodeExists(nodeId: string): Promise<boolean> {
  return exists(livePath("nodes", nodeId));
}

async function draftNodeExists(dreamRunId: string, nodeId: string): Promise<boolean> {
  return exists(draftPath(dreamRunId, "nodes", nodeId));
}

async function readWhatFromRoots(
  dreamRunId: string,
  nodeId: string,
): Promise<{ content: string; source: "draft" | "live" | "empty" }> {
  const d = draftPath(dreamRunId, "nodes", nodeId, "understand", "what.md");
  if (await exists(d)) {
    return { content: await readFile(d, "utf8"), source: "draft" };
  }
  const live = livePath("nodes", nodeId, "understand", "what.md");
  if (await exists(live)) {
    return { content: await readFile(live, "utf8"), source: "live" };
  }
  return { content: "## Current\n\n\n## History\n", source: "empty" };
}

async function readDayFromRoots(
  dreamRunId: string,
  dayId: string,
): Promise<{ content: string; source: "draft" | "live" | "empty" }> {
  const d = draftPath(dreamRunId, "memory-chain", "days", `${dayId}.md`);
  if (await exists(d)) {
    return { content: await readFile(d, "utf8"), source: "draft" };
  }
  const live = livePath("memory-chain", "days", `${dayId}.md`);
  if (await exists(live)) {
    return { content: await readFile(live, "utf8"), source: "live" };
  }
  return { content: "", source: "empty" };
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function trackEntry(
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
  relPath: string,
  liveExisted: boolean,
): void {
  const op: ManifestOp = liveExisted ? "update" : "create";
  if (!seen.has(relPath)) {
    seen.set(relPath, op);
    entries.push({ op, path: relPath });
  }
}

async function seedNodeInDraft(
  dreamRunId: string,
  nodeId: string,
  meta: { kind: string; aliases?: string[]; what?: string },
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
): Promise<void> {
  const liveExisted = await liveNodeExists(nodeId);
  const base = draftPath(dreamRunId, "nodes", nodeId);
  await mkdir(join(base, "understand"), { recursive: true });
  await mkdir(join(base, "chronology"), { recursive: true });

  const metaRel = `nodes/${nodeId}/node.meta.yaml`;
  const metaFile = draftPath(dreamRunId, ...metaRel.split("/"));
  if (!(await exists(metaFile))) {
    await writeFile(
      metaFile,
      stringify({
        id: nodeId,
        kind: meta.kind,
        aliases: meta.aliases ?? [],
        created_at: new Date().toISOString(),
      }),
      "utf8",
    );
    trackEntry(entries, seen, metaRel, liveExisted && (await exists(livePath("nodes", nodeId, "node.meta.yaml"))));
  }

  const whatRel = `nodes/${nodeId}/understand/what.md`;
  const whatFile = draftPath(dreamRunId, ...whatRel.split("/"));
  if (!(await exists(whatFile))) {
    const body = meta.what?.trim() ?? "";
    await writeFile(whatFile, `## Current\n\n${body}\n\n## History\n`, "utf8");
    trackEntry(
      entries,
      seen,
      whatRel,
      liveExisted && (await exists(livePath("nodes", nodeId, "understand", "what.md"))),
    );
  }

  const indexRel = `nodes/${nodeId}/INDEX.md`;
  const indexFile = draftPath(dreamRunId, ...indexRel.split("/"));
  if (!(await exists(indexFile))) {
    await writeFile(indexFile, `# ${nodeId}\n\nSee understand/what.md\n`, "utf8");
    trackEntry(entries, seen, indexRel, liveExisted && (await exists(livePath("nodes", nodeId, "INDEX.md"))));
  }
}

async function applySemanticToDraft(
  dreamRunId: string,
  patch: Extract<Patch, { type: "semantic" }>,
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
): Promise<void> {
  const nodeId = patch.node;
  const inDraft = await draftNodeExists(dreamRunId, nodeId);
  const inLive = await liveNodeExists(nodeId);
  if (!inDraft && !inLive) {
    throw new Error(`node does not exist (live or this-run draft): ${nodeId}`);
  }

  const { content: file } = await readWhatFromRoots(dreamRunId, nodeId);
  let normalized = file;
  if (!normalized.includes("## Current")) {
    normalized = `## Current\n\n${normalized.trim()}\n\n## History\n`;
  }
  if (!normalized.includes("## History")) {
    normalized = normalized.trimEnd() + "\n\n## History\n";
  }

  const current = extractCurrentSection(normalized);
  const historyMatch = normalized.match(/## History\s*\n([\s\S]*)$/);
  let historyBody = historyMatch ? historyMatch[1] : "";

  const refs = (patch.event_refs ?? []).join(",");
  const stamp = `### ${taipeiDate(patch.ts)} · patch:${patch.patch_id} · events:[${refs}]\n`;

  let newCurrent: string;
  if (patch.operation === "revise" || patch.operation === "resolve_open") {
    if (current.trim()) {
      historyBody = `${stamp}${current.trim()}\n\n` + historyBody;
    }
    newCurrent = patch.content.trim();
  } else {
    newCurrent = current.trim()
      ? `${current.trim()}\n\n${patch.content.trim()}`
      : patch.content.trim();
  }

  const out = `## Current\n\n${newCurrent}\n\n## History\n${historyBody.startsWith("\n") ? historyBody : "\n" + historyBody}`;
  const rel = `nodes/${nodeId}/understand/what.md`;
  const dest = draftPath(dreamRunId, ...rel.split("/"));
  await ensureParent(dest);
  await writeFile(dest, out.endsWith("\n") ? out : out + "\n", "utf8");
  trackEntry(entries, seen, rel, await exists(livePath("nodes", nodeId, "understand", "what.md")));
}

async function applyChainToDraft(
  dreamRunId: string,
  patch: Extract<Patch, { type: "chain" }>,
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
): Promise<void> {
  const dayId = patch.id;
  const { content: existing } = await readDayFromRoots(dreamRunId, dayId);
  const marker = `<!-- patch:${patch.patch_id} -->`;
  if (existing.includes(marker)) return;

  const refs = (patch.event_refs ?? []).join(", ");
  const block = [
    marker,
    `### patch:${patch.patch_id} · events:[${refs}]`,
    "",
    patch.content.trim(),
    "",
  ].join("\n");

  const next = existing.trim()
    ? `${existing.trimEnd()}\n${block}`
    : `# ${dayId}\n\n${block}`;

  const rel = `memory-chain/days/${dayId}.md`;
  const dest = draftPath(dreamRunId, ...rel.split("/"));
  await ensureParent(dest);
  await writeFile(dest, next.endsWith("\n") ? next : next + "\n", "utf8");
  trackEntry(entries, seen, rel, await exists(livePath("memory-chain", "days", `${dayId}.md`)));
}

async function applyFutureToDraft(
  dreamRunId: string,
  patch: Extract<Patch, { type: "future" }>,
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
): Promise<void> {
  const anchor: FutureSightAnchor = {
    id: patch.id,
    anchor_start: patch.anchor_start,
    anchor_end: patch.anchor_end,
    content: patch.content,
    node_refs: patch.node_refs,
    event_refs: patch.event_refs,
    dream_run_id: dreamRunId,
    committed_at: taipeiNowIso(),
  };
  const rel = `future-sight/active/${patch.id}.md`;
  const dest = draftPath(dreamRunId, ...rel.split("/"));
  await ensureParent(dest);
  await writeFile(dest, renderFutureSightMarkdown(anchor), "utf8");
  trackEntry(entries, seen, rel, await exists(livePath("future-sight", "active", `${patch.id}.md`)));
}

async function applyAttributionToDraft(
  dreamRunId: string,
  patch: Extract<Patch, { type: "episodic" }>,
  entries: ManifestEntry[],
  seen: Map<string, ManifestOp>,
): Promise<void> {
  const rel = "candidates/attribution.yaml";
  const draftFile = draftPath(dreamRunId, ...rel.split("/"));
  const liveFile = livePath("candidates", "attribution.yaml");

  let list: unknown[] = [];
  if (await exists(draftFile)) {
    const data = parse(await readFile(draftFile, "utf8")) as { candidates?: unknown[] } | null;
    list = data?.candidates ?? [];
  } else if (await exists(liveFile)) {
    const data = parse(await readFile(liveFile, "utf8")) as { candidates?: unknown[] } | null;
    list = [...(data?.candidates ?? [])];
  }

  const entry = {
    node: patch.node,
    role: patch.role,
    confidence: patch.confidence,
    date: patch.date,
    content: patch.content,
    event_refs: patch.event_refs ?? [],
    status: "pending",
    patch_id: patch.patch_id,
    updated_at: new Date().toISOString(),
  };

  const arr = list as Array<{ patch_id?: string }>;
  const idx = arr.findIndex((x) => x.patch_id === patch.patch_id);
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);

  await ensureParent(draftFile);
  await writeFile(draftFile, stringify({ candidates: arr }), "utf8");
  trackEntry(entries, seen, rel, await exists(liveFile));
}

/** Order: propose_node first (stable among themselves), then remaining in original order. */
function orderPatchesForMaterialize(patches: Patch[]): Patch[] {
  const creates = patches.filter((p) => p.type === "propose_node");
  const rest = patches.filter((p) => p.type !== "propose_node");
  return [...creates, ...rest];
}

export class MaterializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterializeError";
  }
}

/**
 * Materialize patches into dream/draft/{run_id}/. Wipes any prior draft for this run.
 * Does not write live L2. Fails entirely on error (caller should remove draft).
 */
export async function materializeDraft(dreamRunId: string, patches: Patch[]): Promise<DraftManifest> {
  const dir = draftDir(dreamRunId);
  if (await exists(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
  await mkdir(dir, { recursive: true });

  const entries: ManifestEntry[] = [];
  const seen = new Map<string, ManifestOp>();
  const ordered = orderPatchesForMaterialize(patches);

  for (const patch of ordered) {
    try {
      switch (patch.type) {
        case "propose_node": {
          await seedNodeInDraft(
            dreamRunId,
            patch.proposed_id,
            {
              kind: patch.kind,
              aliases: patch.aliases,
              what: patch.seed_facets?.what,
            },
            entries,
            seen,
          );
          break;
        }
        case "semantic": {
          await applySemanticToDraft(dreamRunId, patch, entries, seen);
          break;
        }
        case "chain": {
          await applyChainToDraft(dreamRunId, patch, entries, seen);
          break;
        }
        case "future": {
          await applyFutureToDraft(dreamRunId, patch, entries, seen);
          break;
        }
        case "episodic": {
          const inDraft = await draftNodeExists(dreamRunId, patch.node);
          const inLive = await liveNodeExists(patch.node);
          if (!inDraft && !inLive) {
            throw new Error(`node does not exist (live or this-run draft): ${patch.node}`);
          }
          if (patch.confidence < 0.6) {
            await applyAttributionToDraft(dreamRunId, patch, entries, seen);
          }
          // ≥ 0.6: chronology not implemented — no-op
          break;
        }
        case "dlq_review":
          // Prototype: ignore (do not fail whole materialize)
          logDream("materialize skip dlq_review", { dream_run_id: dreamRunId, patch_id: patch.patch_id });
          break;
        default: {
          const _e: never = patch;
          throw new Error(`unhandled patch: ${JSON.stringify(_e)}`);
        }
      }
    } catch (e) {
      throw new MaterializeError(
        `patch ${patch.patch_id} (${patch.type}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const manifest: DraftManifest = {
    dream_run_id: dreamRunId,
    materialized_at: taipeiNowIso(),
    entries,
  };
  await writeFile(manifestPath(dreamRunId), stringify(manifest), "utf8");
  logDreamDebug("materialize done", {
    dream_run_id: dreamRunId,
    entries: entries.length,
    patches: patches.length,
  });
  return manifest;
}

export async function readManifest(dreamRunId: string): Promise<DraftManifest | null> {
  const p = manifestPath(dreamRunId);
  if (!(await exists(p))) return null;
  return parse(await readFile(p, "utf8")) as DraftManifest;
}

/**
 * Atomically-ish commit draft → live ENGRAM_HOME.
 * On in-process failure, best-effort rollback of files written this call.
 */
export async function commitDraft(dreamRunId: string): Promise<{ committed: string[] }> {
  const manifest = await readManifest(dreamRunId);
  if (!manifest) {
    throw new Error(`no manifest for draft ${dreamRunId}`);
  }

  const committed: string[] = [];
  const backups: Array<{ rel: string; backup: string | null; existed: boolean }> = [];

  try {
    for (const entry of manifest.entries) {
      const src = draftPath(dreamRunId, ...entry.path.split("/"));
      const dest = livePath(...entry.path.split("/"));
      if (!(await exists(src))) {
        throw new Error(`draft missing file: ${entry.path}`);
      }

      const existed = await exists(dest);
      let backup: string | null = null;
      if (existed) {
        backup = `${dest}.engram-bak-${Date.now()}`;
        await copyFile(dest, backup);
      }

      await ensureParent(dest);
      await copyFile(src, dest);
      committed.push(entry.path);
      backups.push({ rel: entry.path, backup, existed });
    }
  } catch (e) {
    // Best-effort rollback
    for (const b of [...backups].reverse()) {
      const dest = livePath(...b.rel.split("/"));
      try {
        if (b.existed && b.backup) {
          await copyFile(b.backup, dest);
        } else if (!b.existed && (await exists(dest))) {
          await rm(dest, { force: true });
        }
      } catch {
        // ignore rollback errors
      }
    }
    for (const b of backups) {
      if (b.backup) {
        try {
          await rm(b.backup, { force: true });
        } catch {
          // ignore
        }
      }
    }
    throw e;
  }

  // Cleanup backups on success
  for (const b of backups) {
    if (b.backup) {
      try {
        await rm(b.backup, { force: true });
      } catch {
        // ignore
      }
    }
  }

  return { committed };
}

export async function draftSummary(dreamRunId: string): Promise<{
  entry_count: number;
  chain_days: string[];
  future_ids: string[];
} | null> {
  const manifest = await readManifest(dreamRunId);
  if (!manifest) return null;
  const chain_days = manifest.entries
    .map((e) => e.path.match(/^memory-chain\/days\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
    .filter((x): x is string => !!x)
    .sort();
  const future_ids = manifest.entries
    .map((e) => e.path.match(/^future-sight\/active\/(.+)\.md$/)?.[1])
    .filter((x): x is string => !!x)
    .sort();
  return {
    entry_count: manifest.entries.length,
    chain_days: [...new Set(chain_days)],
    future_ids: [...new Set(future_ids)],
  };
}

/** List relative paths under a draft (debug). */
export async function listDraftFiles(dreamRunId: string): Promise<string[]> {
  const root = draftDir(dreamRunId);
  if (!(await exists(root))) return [];
  const out: string[] = [];
  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), rel);
      else out.push(rel);
    }
  }
  await walk(root, "");
  return out;
}
