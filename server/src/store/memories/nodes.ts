/** L2 node discovery, initialization, and Current-section access. */

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

/** Resolve a node's long-term understanding file. */
export function whatPath(nodeId: string): string {
  return homePath("memories", "nodes", nodeId, "understand", "what.md");
}

/** Read the Current section of a node's understanding file. */
export async function readWhatCurrent(nodeId: string): Promise<string> {
  const path = whatPath(nodeId);
  if (!(await exists(path))) return "";
  const text = await readFile(path, "utf8");
  return extractCurrentSection(text);
}

/**
 * Extract the live body from a summary／what markdown file.
 * - Day／L2: content under `## Current` until `## History` (inner `##` section titles allowed).
 * - Higher chain (week／month／year): no `## Current` wrapper — whole file is the body.
 */
export function extractCurrentSection(md: string): string {
  if (!/^##\s*Current\b/m.test(md)) {
    const beforeHistory = md.match(/^([\s\S]*?)(?=\n##\s*History\b|$)/);
    return (beforeHistory ? beforeHistory[1] : md).trim();
  }
  const match = md.match(/##\s*Current\s*\n([\s\S]*?)(?=\n##\s*History\b|$)/);
  if (!match) return md.trim();
  return match[1].trim();
}

/** Create a node's standard files when they do not already exist. */
export async function seedNode(
  nodeId: string,
  meta: { kind: string; aliases?: string[]; what?: string },
): Promise<void> {
  const base = homePath("memories", "nodes", nodeId);
  await mkdir(join(base, "understand"), { recursive: true });
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

  const what = whatPath(nodeId);
  if (!(await exists(what))) {
    const body = meta.what?.trim() ?? "";
    await writeFile(
      what,
      `## Current\n\n${body}\n\n## History\n`,
      "utf8",
    );
  }

  const indexPath = join(base, "INDEX.md");
  if (!(await exists(indexPath))) {
    await writeFile(indexPath, `# ${nodeId}\n\nSee understand/what.md\n`, "utf8");
  }
}

/** Read Current text for every persisted node. */
export async function readAllWhatCurrents(): Promise<Array<{ node: string; what_current: string }>> {
  const ids = await listNodeIds();
  const out: Array<{ node: string; what_current: string }> = [];
  for (const id of ids) {
    out.push({ node: id, what_current: await readWhatCurrent(id) });
  }
  return out;
}
