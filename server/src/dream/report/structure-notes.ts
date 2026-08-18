/**
 * Soft structure lint for draft node main files (0.28) and chain summaries (0.31／0.38).
 * Warnings only — never fails the dream job or blocks approve.
 */

import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { draftDir } from "../../store/dreams/dream-runs";
import { listNodeIds } from "../../store/memories/nodes";
import { hasStandingHeadings } from "../../store/memories/nodes";
import { homePath } from "../../store/home";
import { mentionCreateIds } from "../../store/memories/mentions";

const STANDING_HEADINGS = [
  "## Identity",
  "## Relation",
  "## Standing facts",
  "## Current situation",
] as const;

const NODE_MAIN_RE = /^memories\/nodes\/([^/]+)\/\1\.md$/;
/** Vault-relative wikilink to node main: [[nodes/{id}/{id}|...]] or [[nodes/{id}/{id}]] */
const NODE_WIKILINK_RE = /\[\[nodes\/([^/\]]+)\/\1(?:\|[^\]]*)?\]\]/g;

/** Process-narration needles for draft `*.summary.md` (0.38). Case-insensitive. */
export const SUMMARY_PROCESS_NARRATION_NEEDLES = [
  "Reading the write context",
  "Writing the summary",
  "已寫入",
] as const;

export function summaryHasProcessNarration(md: string): boolean {
  const hay = md.toLowerCase();
  return SUMMARY_PROCESS_NARRATION_NEEDLES.some((n) => hay.includes(n.toLowerCase()));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function extractSection(md: string, heading: string, nextHeadings: string[]): string {
  const start = md.indexOf(heading);
  if (start < 0) return "";
  const after = md.slice(start + heading.length);
  let end = after.length;
  for (const h of nextHeadings) {
    const i = after.indexOf(`\n${h}`);
    if (i >= 0 && i < end) end = i;
  }
  return after.slice(0, end).trim();
}

/** Collect draft node main files under draft memories/nodes. */
async function listDraftNodeMains(
  dreamRunId: string,
): Promise<Array<{ id: string; abs: string; rel: string }>> {
  const nodesRoot = join(draftDir(dreamRunId), "memories", "nodes");
  if (!(await exists(nodesRoot))) return [];
  const out: Array<{ id: string; abs: string; rel: string }> = [];
  const entries = await readdir(nodesRoot, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    const rel = `memories/nodes/${id}/${id}.md`;
    const abs = join(draftDir(dreamRunId), ...rel.split("/"));
    if (await exists(abs)) out.push({ id, abs, rel });
  }
  return out;
}

/** Draft chain `*.summary.md` under days／weeks／months／years. */
async function listDraftSummaries(
  dreamRunId: string,
): Promise<Array<{ abs: string; rel: string }>> {
  const chainRoot = join(draftDir(dreamRunId), "memories", "chain");
  if (!(await exists(chainRoot))) return [];
  const out: Array<{ abs: string; rel: string }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".summary.md")) continue;
      const rel = relative(draftDir(dreamRunId), abs).replace(/\\/g, "/");
      out.push({ abs, rel });
    }
  }

  await walk(chainRoot);
  return out;
}

/** Node ids that exist live or will exist after this draft (create mains). */
async function knownNodeIds(dreamRunId: string): Promise<Set<string>> {
  const ids = new Set(await listNodeIds());
  for (const n of await listDraftNodeMains(dreamRunId)) ids.add(n.id);
  return ids;
}

/** True if target node main exists live or in this draft. */
async function nodeMainExists(dreamRunId: string, id: string): Promise<boolean> {
  const draft = join(draftDir(dreamRunId), "memories", "nodes", id, `${id}.md`);
  if (await exists(draft)) return true;
  return exists(homePath("memories", "nodes", id, `${id}.md`));
}

/**
 * Lint draft node mains; return warning lines (no leading `- `).
 * Empty array → Structure notes body is `_None_`.
 */
export async function lintDraftNodeStructure(dreamRunId: string): Promise<string[]> {
  const mains = await listDraftNodeMains(dreamRunId);
  if (mains.length === 0) return [];

  const known = await knownNodeIds(dreamRunId);
  const warnings: string[] = [];

  for (const { id, abs } of mains) {
    const md = await readFile(abs, "utf8");

    // Missing standing headings (order).
    if (!hasStandingHeadings(md)) {
      for (const h of STANDING_HEADINGS) {
        if (!md.includes(h)) {
          warnings.push(`node ${id}: missing heading ${h.replace(/^##\s*/, "")}`);
        }
      }
      // If all headings present but wrong order, still flag.
      if (STANDING_HEADINGS.every((h) => md.includes(h))) {
        warnings.push(`node ${id}: standing headings out of order`);
      }
    }

    // Relation mentions known peer id without wikilink.
    const relation = extractSection(md, "## Relation", [
      "## Standing facts",
      "## Current situation",
    ]);
    if (relation && relation !== "_None_") {
      for (const peer of known) {
        if (peer === id) continue;
        const word = new RegExp(`\\b${escapeRegExp(peer)}\\b`, "i");
        if (!word.test(relation)) continue;
        const linkRe = new RegExp(
          `\\[\\[nodes/${escapeRegExp(peer)}/${escapeRegExp(peer)}(?:\\|[^\\]]*)?\\]\\]`,
        );
        if (!linkRe.test(relation)) {
          warnings.push(`node ${id}: Relation mentions ${peer} without wikilink`);
        }
      }
    }

    // Broken wikilinks to node mains (not in live + this-round draft).
    NODE_WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    const seenBroken = new Set<string>();
    while ((m = NODE_WIKILINK_RE.exec(md)) !== null) {
      const targetId = m[1]!;
      if (await nodeMainExists(dreamRunId, targetId)) continue;
      const key = `nodes/${targetId}/${targetId}`;
      if (seenBroken.has(key)) continue;
      seenBroken.add(key);
      warnings.push(`broken link ${key}`);
    }
  }

  // Also flag legacy paths if somehow present in draft (should be rare).
  const legacyRoot = join(draftDir(dreamRunId), "memories", "nodes");
  if (await exists(legacyRoot)) {
    const dirs = await readdir(legacyRoot, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const what = join(legacyRoot, d.name, "understand", "what.md");
      if (await exists(what)) {
        warnings.push(`node ${d.name}: draft still has legacy understand/what.md`);
      }
    }
  }

  return warnings;
}

/**
 * Soft-lint draft chain summaries: known peer id mentioned with no `[[` at all;
 * process narration leaked into the body (0.38).
 * Does not scan ledger blocks (0.31).
 */
export async function lintDraftChainSummaries(dreamRunId: string): Promise<string[]> {
  const summaries = await listDraftSummaries(dreamRunId);
  if (summaries.length === 0) return [];

  const known = await knownNodeIds(dreamRunId);
  const warnings: string[] = [];

  for (const { abs, rel } of summaries) {
    const md = await readFile(abs, "utf8");
    if (!md.trim()) continue;

    if (summaryHasProcessNarration(md)) {
      warnings.push(`summary ${rel}: process narration`);
    }

    // Heuristic: any wikilink syntax present → skip file-level "no [[" check.
    if (md.includes("[[")) continue;

    for (const peer of known) {
      const word = new RegExp(`\\b${escapeRegExp(peer)}\\b`, "i");
      if (!word.test(md)) continue;
      warnings.push(`summary ${rel}: mentions ${peer} without wikilink`);
    }
  }

  return warnings;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Format server-owned Structure notes section. */
export function formatStructureNotesSection(warnings: string[]): string {
  const body =
    warnings.length === 0
      ? "_None_"
      : warnings.map((w) => `- ${w}`).join("\n");
  return `## Structure notes\n\n${body}`;
}

/**
 * Soft-lint: activity `node-create:` mentions whose draft node main is missing.
 * Does not fail the job or block approve.
 */
export async function lintMentionCreates(
  dreamRunId: string,
  events: Array<{ raw: string }>,
): Promise<string[]> {
  const creates = new Set<string>();
  for (const e of events) {
    for (const id of mentionCreateIds(e.raw)) creates.add(id);
  }
  if (creates.size === 0) return [];

  const draftIds = new Set((await listDraftNodeMains(dreamRunId)).map((n) => n.id));
  const warnings: string[] = [];
  for (const id of [...creates].sort()) {
    if (draftIds.has(id)) continue;
    warnings.push(`mention create ${id} missing from draft nodes`);
  }
  return warnings;
}

/** Scan draft and build the Structure notes markdown section. */
export async function buildStructureNotesSection(
  dreamRunId: string,
  events: Array<{ raw: string }> = [],
): Promise<string> {
  const warnings = [
    ...(await lintDraftNodeStructure(dreamRunId)),
    ...(await lintDraftChainSummaries(dreamRunId)),
    ...(await lintMentionCreates(dreamRunId, events)),
  ];
  return formatStructureNotesSection(warnings);
}

/** Match a store-relative path as a 0.28 node main file. */
export function isNodeMainRel(rel: string): boolean {
  return NODE_MAIN_RE.test(rel.replace(/\\/g, "/"));
}
