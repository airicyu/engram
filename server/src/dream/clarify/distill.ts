/**
 * Clarify distill job: snapshot pending → agent writes draft node mains only →
 * strip whitelist violations → return distilled ids + narrative.
 */

import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "../../config";
import { calendarDate, nowIso } from "../../store/memories/activities";
import {
  readPendingItem,
  type ClarifyPendingItem,
} from "../../store/memories/clarify";
import { listNodeIds } from "../../store/memories/nodes";
import { draftDir, reportPath } from "../../store/dreams/dream-runs";
import { createClarifyDistillAgent } from "../../agent/factory";
import type { ClarifyDistillAgent, ClarifyDistillResult } from "../../agent/clarify/types";
import { logInfo, logError } from "../../log";
import { emitDreamEvent } from "../report/emit-event";

const NODE_MAIN_RE = /^memories\/nodes\/([^/]+)\/\1\.md$/;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** True if store-relative path is an allowed distill write (node main only). */
export function isClarifyDistillAllowedRel(rel: string): boolean {
  const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  return NODE_MAIN_RE.test(norm);
}

async function walkFiles(root: string, prefix = ""): Promise<string[]> {
  if (!(await exists(root))) return [];
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(join(root, entry.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Remove draft files under memories/ that are not node mains, created during distill window,
 * AND restore any pre-existing non-whitelist files whose content changed or were deleted.
 */
export async function stripClarifyDistillViolations(
  dreamRunId: string,
  beforeSnapshot: Map<string, string | null>,
): Promise<string[]> {
  const root = join(draftDir(dreamRunId), "memories");
  const after = await walkFiles(root, "memories");
  const afterSet = new Set(after);
  const stripped: string[] = [];

  // New non-whitelist files → delete
  for (const rel of after) {
    if (beforeSnapshot.has(rel)) continue;
    if (isClarifyDistillAllowedRel(rel)) continue;
    const abs = join(draftDir(dreamRunId), rel);
    await rm(abs, { force: true });
    stripped.push(rel);
  }

  // Pre-existing non-whitelist: restore content or recreate if deleted
  for (const [rel, content] of beforeSnapshot) {
    if (isClarifyDistillAllowedRel(rel)) continue;
    const abs = join(draftDir(dreamRunId), rel);
    if (content === null) continue; // shouldn't happen
    if (!afterSet.has(rel)) {
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
      stripped.push(`restored-deleted:${rel}`);
      continue;
    }
    const now = await readFile(abs, "utf8");
    if (now !== content) {
      await writeFile(abs, content, "utf8");
      stripped.push(`restored-modified:${rel}`);
    }
  }

  if (stripped.length) {
    logInfo("clarify_distill: stripped whitelist violations", {
      dream_run_id: dreamRunId,
      stripped,
    });
  }
  return stripped;
}

/** Snapshot draft memories rel → content (for restore). */
export async function snapshotDraftMemories(dreamRunId: string): Promise<Map<string, string | null>> {
  const root = join(draftDir(dreamRunId), "memories");
  const rels = await walkFiles(root, "memories");
  const out = new Map<string, string | null>();
  for (const rel of rels) {
    try {
      out.set(rel, await readFile(join(draftDir(dreamRunId), rel), "utf8"));
    } catch {
      out.set(rel, null);
    }
  }
  return out;
}

function toPayload(items: ClarifyPendingItem[]) {
  return items.map((i) => ({
    id: i.id,
    kind: i.kind,
    question: i.question,
    answer: i.answer,
    related_nodes: i.related_nodes,
    source_dream_run_id: i.source_dream_run_id,
  }));
}

export async function runClarifyDistill(opts: {
  dreamRunId: string;
  snapshotIds: string[];
  /** Frozen bodies from input.json; when omitted, read each id (E2: no directory listing). */
  pendingItems?: ClarifyPendingItem[];
  agent?: ClarifyDistillAgent;
}): Promise<{
  snapshot_ids: string[];
  distilled_node_ids: string[];
  narrative: string;
}> {
  const { dreamRunId } = opts;
  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "clarify_distill",
    message: `Clarify distill start (pending snapshot ${opts.snapshotIds.length})`,
    detail: { snapshot_ids: opts.snapshotIds },
  });

  let pending: ClarifyPendingItem[];
  if (opts.pendingItems) {
    pending = opts.pendingItems;
  } else {
    pending = [];
    for (const id of opts.snapshotIds) {
      const item = await readPendingItem(id);
      if (item) pending.push(item);
    }
  }

  if (pending.length === 0) {
    emitDreamEvent(dreamRunId, {
      phase: "materialize",
      event: "clarify_distill",
      message: "Clarify distill no-op (empty pending snapshot)",
    });
    return { snapshot_ids: opts.snapshotIds, distilled_node_ids: [], narrative: "_None_" };
  }

  const beforeSnapshot = await snapshotDraftMemories(dreamRunId);
  const beforeRels = new Set(beforeSnapshot.keys());
  const agent = opts.agent ?? createClarifyDistillAgent();
  const ctx = {
    dream_run_id: dreamRunId,
    timezone: config.timezone,
    memory_language: config.memoryLanguage,
    now: nowIso(),
    today: calendarDate(),
    store_dir: config.storeDir,
    draft_dir: draftDir(dreamRunId),
    report_path: reportPath(dreamRunId),
    pending: toPayload(pending),
    existing_node_ids: await listNodeIds(),
  };

  let result: ClarifyDistillResult;
  try {
    result = await agent.distill(ctx);
  } catch (e) {
    logError("clarify_distill agent failed", e, { dream_run_id: dreamRunId });
    throw e;
  }

  await stripClarifyDistillViolations(dreamRunId, beforeSnapshot);

  // Recompute distilled ids from remaining new／changed node mains vs before
  const afterRels = await walkFiles(join(draftDir(dreamRunId), "memories"), "memories");
  const distilledFromDisk: string[] = [];
  for (const rel of afterRels) {
    const m = rel.match(NODE_MAIN_RE);
    if (!m) continue;
    if (!beforeRels.has(rel)) {
      distilledFromDisk.push(m[1]!);
      continue;
    }
    // Updated existing: if agent listed it, keep
    if (result.distilled_node_ids.includes(m[1]!)) distilledFromDisk.push(m[1]!);
  }
  // Union with agent claim ∩ allowed mains that still exist
  const distilled = [...new Set([...distilledFromDisk, ...result.distilled_node_ids.filter((id) => {
    const rel = `memories/nodes/${id}/${id}.md`;
    return afterRels.includes(rel);
  })])].sort();

  const narrative =
    result.narrative?.trim() ||
    (distilled.length
      ? distilled.map((id) => `- \`${id}\``).join("\n")
      : "_None_");

  emitDreamEvent(dreamRunId, {
    phase: "materialize",
    event: "clarify_distill",
    message: `Clarify distill done (${distilled.length} nodes)`,
    detail: { distilled_node_ids: distilled },
  });

  return {
    snapshot_ids: opts.snapshotIds,
    distilled_node_ids: distilled,
    narrative,
  };
}
