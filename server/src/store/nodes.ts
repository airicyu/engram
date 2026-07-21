import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { homePath } from "./home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function listNodeIds(): Promise<string[]> {
  const nodesDir = homePath("nodes");
  if (!(await exists(nodesDir))) return [];
  const entries = await readdir(nodesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function nodeExists(nodeId: string): Promise<boolean> {
  return exists(homePath("nodes", nodeId));
}

export function whatPath(nodeId: string): string {
  return homePath("nodes", nodeId, "understand", "what.md");
}

export async function readWhatCurrent(nodeId: string): Promise<string> {
  const path = whatPath(nodeId);
  if (!(await exists(path))) return "";
  const text = await readFile(path, "utf8");
  return extractCurrentSection(text);
}

export function extractCurrentSection(md: string): string {
  const match = md.match(/## Current\s*\n([\s\S]*?)(?=\n## History|\n## [^C]|$)/);
  if (!match) return md.trim();
  return match[1].trim();
}

export async function readWhatFile(nodeId: string): Promise<string> {
  const path = whatPath(nodeId);
  if (!(await exists(path))) {
    return "## Current\n\n\n## History\n";
  }
  return readFile(path, "utf8");
}

export async function writeWhatFile(nodeId: string, content: string): Promise<void> {
  const dir = homePath("nodes", nodeId, "understand");
  await mkdir(dir, { recursive: true });
  await writeFile(whatPath(nodeId), content, "utf8");
}

export async function applySemanticWhat(opts: {
  nodeId: string;
  operation: "append" | "revise" | "resolve_open";
  content: string;
  patchId: string;
  eventRefs: string[];
  date: string;
}): Promise<void> {
  if (!(await nodeExists(opts.nodeId))) {
    throw new Error(`node does not exist: ${opts.nodeId}`);
  }

  let file = await readWhatFile(opts.nodeId);
  if (!file.includes("## Current")) {
    file = `## Current\n\n${file.trim()}\n\n## History\n`;
  }
  if (!file.includes("## History")) {
    file = file.trimEnd() + "\n\n## History\n";
  }

  const current = extractCurrentSection(file);
  const historyMatch = file.match(/## History\s*\n([\s\S]*)$/);
  let historyBody = historyMatch ? historyMatch[1] : "";

  const refs = opts.eventRefs.join(",");
  const stamp = `### ${opts.date} · patch:${opts.patchId} · events:[${refs}]\n`;

  let newCurrent: string;
  if (opts.operation === "revise" || opts.operation === "resolve_open") {
    if (current.trim()) {
      historyBody = `${stamp}${current.trim()}\n\n` + historyBody;
    }
    newCurrent = opts.content.trim();
  } else {
    // append
    newCurrent = current.trim()
      ? `${current.trim()}\n\n${opts.content.trim()}`
      : opts.content.trim();
  }

  const out = `## Current\n\n${newCurrent}\n\n## History\n${historyBody.startsWith("\n") ? historyBody : "\n" + historyBody}`;
  await writeWhatFile(opts.nodeId, out.endsWith("\n") ? out : out + "\n");
}

export async function seedNode(
  nodeId: string,
  meta: { kind: string; aliases?: string[]; what?: string },
): Promise<void> {
  const base = homePath("nodes", nodeId);
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

export async function readAllWhatCurrents(): Promise<Array<{ node: string; what_current: string }>> {
  const ids = await listNodeIds();
  const out: Array<{ node: string; what_current: string }> = [];
  for (const id of ids) {
    out.push({ node: id, what_current: await readWhatCurrent(id) });
  }
  return out;
}
