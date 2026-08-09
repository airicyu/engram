/** L2 node discovery, initialization, and standing-understanding body access. */

import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "../../yaml";
import { homePath } from "../home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** List all persisted L2 node identifiers. */
export async function listNodeIds(): Promise<string[]> {
  const nodesDir = homePath("memories", "nodes");
  if (!(await exists(nodesDir))) return [];
  const entries = await readdir(nodesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

/** Return whether a node directory exists. */
export async function nodeExists(nodeId: string): Promise<boolean> {
  return exists(homePath("memories", "nodes", nodeId));
}

/**
 * Resolve a node's standing understanding file (0.28: `nodes/{id}/{id}.md`).
 * Store-relative: `memories/nodes/{id}/{id}.md`.
 */
export function understandingPath(nodeId: string): string {
  return homePath("memories", "nodes", nodeId, `${nodeId}.md`);
}

/** Store-relative path for draft／git／manifest (no leading slash). */
export function understandingRel(nodeId: string): string {
  return `memories/nodes/${nodeId}/${nodeId}.md`;
}

/**
 * Four-section standing understanding skeleton (0.25 semantics; 0.28 path).
 * Empty sections use `_None_`.
 */
export function standingUnderstandingMarkdown(sections: {
  identity?: string;
  relation?: string;
  standingFacts?: string;
  currentSituation?: string;
}): string {
  const body = (s: string | undefined) => {
    const t = (s ?? "").trim();
    return t.length ? t : "_None_";
  };
  return [
    "## Identity",
    "",
    body(sections.identity),
    "",
    "## Relation",
    "",
    body(sections.relation),
    "",
    "## Standing facts",
    "",
    body(sections.standingFacts),
    "",
    "## Current situation",
    "",
    body(sections.currentSituation),
    "",
  ].join("\n");
}

/** True when markdown contains the four standing headings in order. */
export function hasStandingHeadings(md: string): boolean {
  const i = md.indexOf("## Identity");
  const r = md.indexOf("## Relation");
  const s = md.indexOf("## Standing facts");
  const c = md.indexOf("## Current situation");
  return i >= 0 && r > i && s > r && c > s;
}

/** Obsidian vault-relative wikilink to a node main file (P1). Display name defaults to id. */
export function nodeWikilink(nodeId: string, displayName?: string): string {
  const label = (displayName ?? nodeId).trim() || nodeId;
  return `[[nodes/${nodeId}/${nodeId}|${label}]]`;
}

/** Read the narrative body of a node's understanding file (whole file = standing understanding in 0.16+; 0.25 expects four fixed headings). */
export async function readUnderstanding(nodeId: string): Promise<string> {
  const path = understandingPath(nodeId);
  if (!(await exists(path))) return "";
  const text = await readFile(path, "utf8");
  return extractCurrentSection(text);
}

/**
 * Extract the live narrative body from a summary／what markdown file.
 * - 0.16+: whole file is the body (day summary、node main、week／month／year).
 * - Pre-0.16 day／L2: peel `## Current` until `## History` so unmigrated stores still read.
 */
export function extractCurrentSection(md: string): string {
  if (!/^##\s*Current\b/m.test(md)) {
    // 0.16 whole-file body, or higher-chain snapshot; drop legacy History tail if present.
    const beforeHistory = md.match(/^([\s\S]*?)(?=\n##\s*History\b|$)/);
    return (beforeHistory ? beforeHistory[1] : md).trim();
  }
  const match = md.match(/##\s*Current\s*\n([\s\S]*?)(?=\n##\s*History\b|$)/);
  if (!match) return md.trim();
  return match[1].trim();
}

/**
 * Create a node's standard files when they do not already exist.
 * 0.28: main file `{id}.md` with four-section seed; no stub INDEX／understand/.
 */
export async function seedNode(
  nodeId: string,
  meta: { kind: string; aliases?: string[]; what?: string },
): Promise<void> {
  const base = homePath("memories", "nodes", nodeId);
  await mkdir(base, { recursive: true });
  await mkdir(join(base, "chronology"), { recursive: true });

  const metaPath = join(base, "node.meta.yaml");
  if (!(await exists(metaPath))) {
    await writeFile(
      metaPath,
      stringify({
        id: nodeId,
        kind: meta.kind,
        aliases: meta.aliases ?? [],
        created_at: new Date().toISOString(),
      }),
      "utf8",
    );
  }

  const main = understandingPath(nodeId);
  if (!(await exists(main))) {
    const identity = meta.what?.trim() ?? "";
    await writeFile(
      main,
      standingUnderstandingMarkdown({
        identity: identity || undefined,
      }),
      "utf8",
    );
  }
}

/** Read standing understanding body for every persisted node. */
export async function readAllUnderstandings(): Promise<Array<{ node: string; understanding: string }>> {
  const ids = await listNodeIds();
  const out: Array<{ node: string; understanding: string }> = [];
  for (const id of ids) {
    out.push({ node: id, understanding: await readUnderstanding(id) });
  }
  return out;
}
