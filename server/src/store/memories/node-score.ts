/**
 * L2 node activity scores — pure script math (0.19).
 * AI only emits categories; this module owns score.yaml／registry／boost／downscale／display.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "../../yaml";
import { homePath } from "../home";
import { listNodeIds } from "./nodes";
import { logInfo } from "../../log";

/** Involvement categories (semantic names; never GRADE_*). */
export type NodeScoreCategory = "mention" | "update" | "focus";

export const NODE_SCORE_CATEGORIES: readonly NodeScoreCategory[] = [
  "mention",
  "update",
  "focus",
] as const;

/** v1 constants — hardcoded (INDEX #5). */
export const SCORE = {
  S0: 100,
  S_min: 50,
  S_target: 1000,
  S_max: 2000,
  boost: {
    mention: 10,
    update: 35,
    focus: 80,
  },
} as const;

const CATEGORY_RANK: Record<NodeScoreCategory, number> = {
  mention: 1,
  update: 2,
  focus: 3,
};

export interface NodeScoreFile {
  score: number;
  score_timestamp: string;
}

export interface NodeScoreRegistry {
  max_score: number;
  updated_at?: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertConstants(): void {
  const { S0, S_min, S_target, S_max, boost } = SCORE;
  if (!(S_min <= S0 && S0 <= S_target && S_target < S_max)) {
    throw new Error("node-score constants violate S_min ≤ S0 ≤ S_target < S_max");
  }
  for (const [k, v] of Object.entries(boost)) {
    if (!(typeof v === "number" && v > 0)) {
      throw new Error(`node-score boost.${k} must be > 0`);
    }
  }
}
assertConstants();

/** True iff s is a legal involvement category. */
export function isValidCategory(s: unknown): s is NodeScoreCategory {
  return s === "mention" || s === "update" || s === "focus";
}

/** Higher category wins (focus > update > mention). */
export function maxCategory(a: NodeScoreCategory, b: NodeScoreCategory): NodeScoreCategory {
  return CATEGORY_RANK[a] >= CATEGORY_RANK[b] ? a : b;
}

/** Boost points for a category. */
export function boostFor(category: NodeScoreCategory): number {
  return SCORE.boost[category];
}

export function scoreYamlPath(nodeId: string): string {
  return homePath("memories", "nodes", nodeId, "score.yaml");
}

export function registryPath(): string {
  return homePath("memories", "node-score-registry.yaml");
}

/** Relative store paths for git staging after score writes. */
export function scoreRelPath(nodeId: string): string {
  return `memories/nodes/${nodeId}/score.yaml`;
}

export function registryRelPath(): string {
  return "memories/node-score-registry.yaml";
}

function asNonNegNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Read one node's score.yaml; null if missing／unparseable. */
export async function readNodeScore(nodeId: string): Promise<NodeScoreFile | null> {
  const path = scoreYamlPath(nodeId);
  if (!(await exists(path))) return null;
  try {
    const parsed = parse(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const score = asNonNegNumber(obj.score);
    const ts = typeof obj.score_timestamp === "string" ? obj.score_timestamp : null;
    if (score === null || !ts) return null;
    return { score, score_timestamp: ts };
  } catch {
    return null;
  }
}

/** Write score.yaml for a node. */
export async function writeNodeScore(nodeId: string, file: NodeScoreFile): Promise<void> {
  const path = scoreYamlPath(nodeId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    stringify({
      score: file.score,
      score_timestamp: file.score_timestamp,
    }),
    "utf8",
  );
}

/**
 * Ensure score.yaml exists. Missing → write S0 at as_of (runtime guard for unmigrated nodes).
 * Returns the effective score file.
 */
export async function ensureNodeScore(nodeId: string, asOf: string): Promise<NodeScoreFile> {
  const existing = await readNodeScore(nodeId);
  if (existing) return existing;
  const file: NodeScoreFile = { score: SCORE.S0, score_timestamp: asOf };
  await writeNodeScore(nodeId, file);
  logInfo("node-score: initialized missing score.yaml to S0", { node_id: nodeId });
  return file;
}

/** Read registry; null if missing. */
export async function readRegistry(): Promise<NodeScoreRegistry | null> {
  const path = registryPath();
  if (!(await exists(path))) return null;
  try {
    const parsed = parse(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const max_score = asNonNegNumber(obj.max_score);
    if (max_score === null) return null;
    const updated_at =
      typeof obj.updated_at === "string" ? obj.updated_at : undefined;
    return { max_score, updated_at };
  } catch {
    return null;
  }
}

/** Write registry. */
export async function writeRegistry(reg: NodeScoreRegistry): Promise<void> {
  const path = registryPath();
  await mkdir(dirname(path), { recursive: true });
  const doc: Record<string, unknown> = { max_score: reg.max_score };
  if (reg.updated_at) doc.updated_at = reg.updated_at;
  await writeFile(path, stringify(doc), "utf8");
}

/** Rescan all node score.yaml files and return the max score (0 if none). */
export async function rescanMaxScore(): Promise<number> {
  const ids = await listNodeIds();
  let max = 0;
  for (const id of ids) {
    const s = await readNodeScore(id);
    if (s && s.score > max) max = s.score;
  }
  return max;
}

/** Rescan and write registry.max_score. */
export async function refreshRegistryMax(asOf?: string): Promise<number> {
  const max_score = await rescanMaxScore();
  await writeRegistry({
    max_score,
    updated_at: asOf,
  });
  return max_score;
}

/**
 * Increment an existing node's score by category boost.
 * Ensures score file first (S0 if missing). Does not downscale.
 */
export async function incrementNodeScore(
  nodeId: string,
  category: NodeScoreCategory,
  asOf: string,
): Promise<NodeScoreFile> {
  if (!isValidCategory(category)) {
    throw new Error(`invalid_category: ${String(category)}`);
  }
  const cur = await ensureNodeScore(nodeId, asOf);
  const next: NodeScoreFile = {
    score: cur.score + boostFor(category),
    score_timestamp: asOf,
  };
  await writeNodeScore(nodeId, next);
  return next;
}

/**
 * Global downscale flow (INDEX #9). Independent of dream.
 * No-op when no scores／max ≤ S_target. Skips exclude_node_ids.
 * Always rescans registry at end when any work may have run (or after early no-op max check uses rescan).
 */
export async function downscaleAll(opts: {
  as_of: string;
  exclude_node_ids?: string[];
}): Promise<{ ran: boolean; factor: number; max_before: number; max_after: number }> {
  const exclude = new Set(opts.exclude_node_ids ?? []);
  const max_before = await rescanMaxScore();
  if (max_before <= 0) {
    return { ran: false, factor: 1, max_before, max_after: max_before };
  }
  if (max_before <= SCORE.S_target) {
    return { ran: false, factor: 1, max_before, max_after: max_before };
  }

  const factor = max_before / SCORE.S_target;
  const ids = await listNodeIds();
  for (const id of ids) {
    if (exclude.has(id)) continue;
    const cur = await readNodeScore(id);
    if (!cur) continue;
    const nextScore = Math.max(cur.score / factor, SCORE.S_min);
    await writeNodeScore(id, {
      score: nextScore,
      score_timestamp: opts.as_of,
    });
  }

  const max_after = await refreshRegistryMax(opts.as_of);
  return { ran: true, factor, max_before, max_after };
}

/**
 * Display score 1–100 relative to max_score.
 * null when max missing or ≤ 0.
 */
export function displayScore(score: number, maxScore: number | null | undefined): number | null {
  if (maxScore == null || maxScore <= 0) return null;
  return Math.ceil((score / maxScore) * 100);
}

/** Initialize a brand-new node at S0 (approve path for creates). */
export async function initNewNodeScore(nodeId: string, asOf: string): Promise<NodeScoreFile> {
  const file: NodeScoreFile = { score: SCORE.S0, score_timestamp: asOf };
  await writeNodeScore(nodeId, file);
  return file;
}

/**
 * Collapse involvement rows by id, keeping the highest category.
 * Invalid categories are collected separately (caller decides fail vs skip).
 */
export function collapseInvolvements(
  rows: Array<{ id: string; category: string; reason?: string }>,
): {
  byId: Map<string, { id: string; category: NodeScoreCategory; reason?: string }>;
  invalid: Array<{ id: string; category: string }>;
} {
  const byId = new Map<string, { id: string; category: NodeScoreCategory; reason?: string }>();
  const invalid: Array<{ id: string; category: string }> = [];
  for (const row of rows) {
    if (!row.id || typeof row.id !== "string") continue;
    if (!isValidCategory(row.category)) {
      invalid.push({ id: row.id, category: String(row.category) });
      continue;
    }
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, {
        id: row.id,
        category: row.category,
        reason: row.reason,
      });
    } else {
      const cat = maxCategory(prev.category, row.category);
      byId.set(row.id, {
        id: row.id,
        category: cat,
        reason: cat === row.category ? row.reason ?? prev.reason : prev.reason ?? row.reason,
      });
    }
  }
  return { byId, invalid };
}
