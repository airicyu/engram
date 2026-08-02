/**
 * Dream × node-score: involvements artifact IO, report section, approve settlement.
 */

import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "../../yaml";
import { draftDir, reportPath } from "../../store/dreams/dream-runs";
import type { DraftManifest } from "../../store/dreams/draft";
import { nodeExists } from "../../store/memories/nodes";
import {
  SCORE,
  collapseInvolvements,
  downscaleAll,
  incrementNodeScore,
  initNewNodeScore,
  isValidCategory,
  refreshRegistryMax,
  registryRelPath,
  scoreRelPath,
  type NodeScoreCategory,
} from "../../store/memories/node-score";
import { logInfo } from "../../log";

export const INVOLVEMENTS_ARTIFACT_REL = "node-score-involvements.yaml";
export const INVOLVEMENTS_HEADING = "## Node score involvements";

export interface InvolvementRow {
  id: string;
  category: NodeScoreCategory;
  reason?: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function involvementsArtifactPath(dreamRunId: string): string {
  return join(draftDir(dreamRunId), INVOLVEMENTS_ARTIFACT_REL);
}

/** Parse raw YAML document into rows (may include invalid categories). */
function parseRawRows(doc: unknown): Array<{ id: string; category: string; reason?: string }> {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
  const nodes = (doc as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const out: Array<{ id: string; category: string; reason?: string }> = [];
  for (const row of nodes) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id.trim()) continue;
    const category = typeof r.category === "string" ? r.category : "";
    const reason = typeof r.reason === "string" ? r.reason : undefined;
    out.push({ id: r.id.trim(), category, reason });
  }
  return out;
}

/**
 * Read involvements artifact. Missing file → empty list (allowed).
 * Throws InvalidInvolvementCategoryError if any invalid category present.
 */
export async function readInvolvementsArtifact(dreamRunId: string): Promise<InvolvementRow[]> {
  const path = involvementsArtifactPath(dreamRunId);
  if (!(await exists(path))) return [];
  let doc: unknown;
  try {
    doc = parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
  const raw = parseRawRows(doc);
  const { byId, invalid } = collapseInvolvements(raw);
  if (invalid.length > 0) {
    throw new InvalidInvolvementCategoryError(invalid);
  }
  return [...byId.values()];
}

/** Write involvements artifact (collapsed valid rows only). */
export async function writeInvolvementsArtifact(
  dreamRunId: string,
  rows: InvolvementRow[],
): Promise<void> {
  const path = involvementsArtifactPath(dreamRunId);
  const nodes = rows.map((r) => {
    const o: Record<string, string> = { id: r.id, category: r.category };
    if (r.reason?.trim()) o.reason = r.reason.trim();
    return o;
  });
  await writeFile(path, stringify({ nodes }), "utf8");
}

/** Soft read for pending GET: never throws; invalid categories dropped from list. */
export async function readInvolvementsForPending(dreamRunId: string): Promise<InvolvementRow[]> {
  const path = involvementsArtifactPath(dreamRunId);
  if (!(await exists(path))) return [];
  let doc: unknown;
  try {
    doc = parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
  const { byId } = collapseInvolvements(parseRawRows(doc));
  return [...byId.values()];
}

export class InvalidInvolvementCategoryError extends Error {
  readonly invalid: Array<{ id: string; category: string }>;
  constructor(invalid: Array<{ id: string; category: string }>) {
    const detail = invalid.map((x) => `${x.id}:${x.category}`).join(", ");
    super(`invalid node-score category in involvements artifact: ${detail}`);
    this.name = "InvalidInvolvementCategoryError";
    this.invalid = invalid;
  }
}

/** Validate artifact before entering pending_review. Missing = ok. */
export async function assertInvolvementsValidForPending(dreamRunId: string): Promise<void> {
  await readInvolvementsArtifact(dreamRunId);
}

/** Markdown table for report section body (without heading). */
export function formatInvolvementsSectionBody(rows: InvolvementRow[]): string {
  if (rows.length === 0) return "_None_";
  const lines = [
    "| node | category | reason |",
    "|------|----------|--------|",
  ];
  for (const r of rows) {
    const reason = (r.reason ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${r.id} | ${r.category} | ${reason} |`);
  }
  return lines.join("\n");
}

export function formatInvolvementsSection(rows: InvolvementRow[]): string {
  return `${INVOLVEMENTS_HEADING}\n\n${formatInvolvementsSectionBody(rows)}`;
}

/**
 * Replace or insert the server-owned involvements section in an existing report file.
 * Preserves rollup／Appendix／Narrative.
 */
export async function rewriteReportInvolvementsSection(dreamRunId: string): Promise<void> {
  const path = reportPath(dreamRunId);
  if (!(await exists(path))) return;
  let md = await readFile(path, "utf8");
  const rows = await readInvolvementsForPending(dreamRunId);
  const section = formatInvolvementsSection(rows);

  if (/\n## Node score involvements\b/.test(md)) {
    md = md.replace(
      /\n## Node score involvements\b[\s\S]*?(?=\n## Appendix — pending deploy\b|\n## [^\n]+|$)/,
      `\n${section}\n`,
    );
  } else if (/\n## Appendix — pending deploy\b/.test(md)) {
    md = md.replace(
      /\n## Appendix — pending deploy\b/,
      `\n${section}\n\n## Appendix — pending deploy`,
    );
  } else {
    md = `${md.trimEnd()}\n\n${section}\n`;
  }
  await writeFile(path, md.endsWith("\n") ? md : `${md}\n`, "utf8");
}

/** Patch one involvement category (2a). Does not change live scores. */
export async function patchInvolvementCategory(
  dreamRunId: string,
  id: string,
  category: string,
): Promise<InvolvementRow> {
  if (!isValidCategory(category)) {
    throw new PatchInvalidCategoryError(category);
  }
  const rows = await readInvolvementsArtifact(dreamRunId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) {
    throw new InvolvementNotFoundError(id);
  }
  rows[idx] = { ...rows[idx], category };
  await writeInvolvementsArtifact(dreamRunId, rows);
  await rewriteReportInvolvementsSection(dreamRunId);
  return rows[idx];
}

export class PatchInvalidCategoryError extends Error {
  readonly category: string;
  constructor(category: string) {
    super(`invalid_category: ${category}`);
    this.name = "PatchInvalidCategoryError";
    this.category = category;
  }
}

export class InvolvementNotFoundError extends Error {
  readonly id: string;
  constructor(id: string) {
    super(`involvement_not_found: ${id}`);
    this.name = "InvolvementNotFoundError";
    this.id = id;
  }
}

/** Node ids newly created this dream (from manifest create ops under memories/nodes/). */
export function createdNodeIdsFromManifest(manifest: DraftManifest | null): string[] {
  const ids = new Set<string>();
  for (const e of manifest?.entries ?? []) {
    if (e.op !== "create") continue;
    const m = e.path.match(/^memories\/nodes\/([^/]+)\//);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

/**
 * Settle live scores after commitDraft (non empty_patches).
 * Returns relative paths to include in the dream git commit.
 */
export async function settleNodeScoresOnApprove(opts: {
  dream_run_id: string;
  as_of: string;
  manifest: DraftManifest | null;
}): Promise<string[]> {
  const created = new Set(createdNodeIdsFromManifest(opts.manifest));
  const rows = await readInvolvementsArtifact(opts.dream_run_id);
  const touched = new Set<string>();
  let anyOverMax = false;

  for (const row of rows) {
    if (created.has(row.id)) {
      // New nodes ignore boost; set to S0 later.
      continue;
    }
    if (!(await nodeExists(row.id))) {
      logInfo("node-score: skip ghost involvement id", {
        dream_run_id: opts.dream_run_id,
        node_id: row.id,
        category: row.category,
      });
      continue;
    }
    if (!isValidCategory(row.category)) {
      throw new Error(`invalid_category during settle: ${row.id}:${row.category}`);
    }
    const next = await incrementNodeScore(row.id, row.category, opts.as_of);
    touched.add(scoreRelPath(row.id));
    if (next.score > SCORE.S_max) anyOverMax = true;
  }

  if (anyOverMax) {
    await downscaleAll({
      as_of: opts.as_of,
      exclude_node_ids: [...created],
    });
    // All non-excluded score files may have changed — stage whole nodes tree scores via rescan paths.
    // Safer: re-list created+incremented; for downscale every non-exclude changed.
    // Stage registry + all node score paths we can find that aren't only-created.
    const { listNodeIds } = await import("../../store/memories/nodes");
    for (const id of await listNodeIds()) {
      if (created.has(id)) continue;
      touched.add(scoreRelPath(id));
    }
  }

  for (const id of created) {
    await initNewNodeScore(id, opts.as_of);
    touched.add(scoreRelPath(id));
  }

  await refreshRegistryMax(opts.as_of);
  touched.add(registryRelPath());

  return [...touched].sort();
}
