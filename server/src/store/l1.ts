import { mkdir, readFile, readdir, rm, writeFile, appendFile, access, rename } from "node:fs/promises";
import { join } from "node:path";
import { homePath } from "./home";

const SUMMARY_FILE = "summary.md";
const LEGACY_SUMMARY_FILE = "today-summary.md";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** L1 global digest — pending until dream clears; not necessarily "today". */
function summaryPath(): string {
  return homePath("short-term-memory", SUMMARY_FILE);
}

function legacySummaryPath(): string {
  return homePath("short-term-memory", LEGACY_SUMMARY_FILE);
}

export async function migrateL1SummaryFile(): Promise<void> {
  const legacy = legacySummaryPath();
  const current = summaryPath();
  if (await exists(legacy) && !(await exists(current))) {
    await rename(legacy, current);
  }
}

export async function ensureL1SummaryFile(): Promise<void> {
  await migrateL1SummaryFile();
  if (!(await exists(summaryPath()))) {
    await writeFile(summaryPath(), "", "utf8");
  }
}

function nodeNotesPath(nodeId: string): string {
  return homePath("short-term-memory", "nodes", nodeId, "notes.md");
}

export async function appendSummary(line: string): Promise<void> {
  await ensureL1SummaryFile();
  await appendFile(summaryPath(), line.endsWith("\n") ? line : line + "\n", "utf8");
}

/** @deprecated Use appendSummary */
export const appendTodaySummary = appendSummary;

export async function appendNodeNotes(nodeId: string, line: string): Promise<void> {
  const dir = homePath("short-term-memory", "nodes", nodeId);
  await mkdir(dir, { recursive: true });
  await appendFile(nodeNotesPath(nodeId), line.endsWith("\n") ? line : line + "\n", "utf8");
}

export async function readSummary(): Promise<string> {
  await ensureL1SummaryFile();
  if (!(await exists(summaryPath()))) return "";
  return readFile(summaryPath(), "utf8");
}

/** @deprecated Use readSummary */
export const readTodaySummary = readSummary;

export async function readAllNodeNotes(): Promise<Record<string, string>> {
  const nodesDir = homePath("short-term-memory", "nodes");
  if (!(await exists(nodesDir))) return {};
  const entries = await readdir(nodesDir, { withFileTypes: true });
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = join(nodesDir, e.name, "notes.md");
    if (await exists(p)) {
      out[e.name] = await readFile(p, "utf8");
    }
  }
  return out;
}

export async function isL1Empty(): Promise<boolean> {
  const summary = (await readSummary()).trim();
  if (summary) return false;
  const notes = await readAllNodeNotes();
  return Object.values(notes).every((v) => !v.trim());
}

export async function clearL1(): Promise<void> {
  await writeFile(summaryPath(), "", "utf8");
  const nodesDir = homePath("short-term-memory", "nodes");
  if (await exists(nodesDir)) {
    await rm(nodesDir, { recursive: true, force: true });
    await mkdir(nodesDir, { recursive: true });
  }
}
