/** L1 short-term memory pool persistence and derived presentation files. */

import { mkdir, readFile, rm, writeFile, access, rename } from "node:fs/promises";
import { $ } from "bun";
import { homePath } from "./home";
import { readAllEvents } from "./events";

const SUMMARY_FILE = "summary.md";
const LEGACY_SUMMARY_FILE = "today-summary.md";
const POOL_FILE = "pool.jsonl";

/** One L1 pool entry mirrored from an L0 event. */
export interface PoolEntry {
  id: string;
  ts: string;
  raw: string;
  node_refs?: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function summaryPath(): string {
  return homePath("short-term-memory", SUMMARY_FILE);
}

function legacySummaryPath(): string {
  return homePath("short-term-memory", LEGACY_SUMMARY_FILE);
}

function poolPath(): string {
  return homePath("short-term-memory", POOL_FILE);
}

function nodeNotesPath(nodeId: string): string {
  return homePath("short-term-memory", "nodes", nodeId, "notes.md");
}

/** Rename the legacy L1 summary file when needed. */
export async function migrateL1SummaryFile(): Promise<void> {
  const legacy = legacySummaryPath();
  const current = summaryPath();
  if (await exists(legacy) && !(await exists(current))) {
    await rename(legacy, current);
  }
}

async function ensurePoolFile(): Promise<void> {
  await mkdir(homePath("short-term-memory"), { recursive: true });
  if (!(await exists(poolPath()))) {
    await writeFile(poolPath(), "", "utf8");
  }
}

/** Migrate legacy summary.md lines into pool.jsonl once. */
async function migrateSummaryToPool(): Promise<void> {
  await ensurePoolFile();
  const poolText = await readFile(poolPath(), "utf8");
  if (poolText.trim()) return;

  await migrateL1SummaryFile();
  if (!(await exists(summaryPath()))) return;
  const summary = await readFile(summaryPath(), "utf8");
  if (!summary.trim()) return;

  const idRe = /\(([eE]\d+)\)/g;
  const ids = new Set<string>();
  for (const m of summary.matchAll(idRe)) {
    ids.add(m[1]);
  }
  if (ids.size === 0) return;

  const events = await readAllEvents();
  const byId = new Map(events.map((e) => [e.id, e]));
  const entries: PoolEntry[] = [];
  for (const id of ids) {
    const ev = byId.get(id);
    if (ev) {
      entries.push({
        id: ev.id,
        ts: ev.ts,
        raw: ev.raw,
        node_refs: ev.node_refs,
      });
    }
  }
  if (entries.length === 0) return;
  await writeFile(poolPath(), entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  await renderPresentation(entries);
}

/** Initialize L1 storage and migrate legacy summary contents. */
export async function ensureL1SummaryFile(): Promise<void> {
  await migrateL1SummaryFile();
  await ensurePoolFile();
  await migrateSummaryToPool();
  if (!(await exists(summaryPath()))) {
    await writeFile(summaryPath(), "", "utf8");
  }
}

function formatLine(entry: PoolEntry): string {
  return `- [${entry.ts}] (${entry.id}) ${entry.raw.trim()}`;
}

async function renderPresentation(entries: PoolEntry[]): Promise<void> {
  await mkdir(homePath("short-term-memory"), { recursive: true });
  const summary = entries.map(formatLine).join("\n");
  await writeFile(summaryPath(), summary ? summary + "\n" : "", "utf8");

  const nodesDir = homePath("short-term-memory", "nodes");
  if (await exists(nodesDir)) {
    await rm(nodesDir, { recursive: true, force: true });
  }
  await mkdir(nodesDir, { recursive: true });

  const byNode = new Map<string, PoolEntry[]>();
  for (const e of entries) {
    for (const nodeId of e.node_refs ?? []) {
      const list = byNode.get(nodeId) ?? [];
      list.push(e);
      byNode.set(nodeId, list);
    }
  }
  for (const [nodeId, list] of byNode) {
    const dir = homePath("short-term-memory", "nodes", nodeId);
    await mkdir(dir, { recursive: true });
    const body = list.map(formatLine).join("\n");
    await writeFile(nodeNotesPath(nodeId), body ? body + "\n" : "", "utf8");
  }
}

/** Read the current L1 pool entries. */
export async function readPoolEntries(): Promise<PoolEntry[]> {
  await ensureL1SummaryFile();
  const text = await readFile(poolPath(), "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PoolEntry);
}

/** List event identifiers currently retained in L1. */
export async function listPoolEventIds(): Promise<string[]> {
  const entries = await readPoolEntries();
  return entries.map((e) => e.id);
}

/** Read L1 entries belonging to a frozen dream scope. */
export async function readPoolEntriesForScope(scope: string[]): Promise<PoolEntry[]> {
  const set = new Set(scope);
  return (await readPoolEntries()).filter((e) => set.has(e.id));
}

/** Add a unique event to L1 and refresh derived files. */
export async function appendPoolEntry(entry: PoolEntry): Promise<void> {
  await ensureL1SummaryFile();
  const entries = await readPoolEntries();
  if (entries.some((e) => e.id === entry.id)) return;
  entries.push(entry);
  await writeFile(poolPath(), entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  await renderPresentation(entries);
}

/** @deprecated Prefer appendPoolEntry — kept for fixtures that only need a visible L1 line. */
export async function appendSummary(line: string): Promise<void> {
  await ensureL1SummaryFile();
  const match = line.match(/\(([eE]\d+)\)/);
  const id = match?.[1] ?? `fixture-${Date.now()}`;
  const tsMatch = line.match(/\[([^\]]+)\]/);
  const raw = line.replace(/^-\s*/, "").replace(/\[[^\]]+\]\s*/, "").replace(/\([eE]\d+\)\s*/, "").trim();
  await appendPoolEntry({
    id,
    ts: tsMatch?.[1] ?? new Date().toISOString(),
    raw: raw || line.trim(),
  });
}

/** @deprecated Use appendSummary */
export const appendTodaySummary = appendSummary;

/** Legacy no-op; node notes are derived from pool entry references. */
export async function appendNodeNotes(_nodeId: string, _line: string): Promise<void> {
  // Node notes are derived from pool entries' node_refs on render.
}

/** Render the current L1 pool as a markdown summary. */
export async function readSummary(): Promise<string> {
  const entries = await readPoolEntries();
  if (entries.length === 0) return "";
  return entries.map(formatLine).join("\n") + "\n";
}

/** @deprecated Use readSummary */
export const readTodaySummary = readSummary;

/** Render L1 notes grouped by referenced node. */
export async function readAllNodeNotes(): Promise<Record<string, string>> {
  const entries = await readPoolEntries();
  const byNode = new Map<string, PoolEntry[]>();
  for (const e of entries) {
    for (const nodeId of e.node_refs ?? []) {
      const list = byNode.get(nodeId) ?? [];
      list.push(e);
      byNode.set(nodeId, list);
    }
  }
  const out: Record<string, string> = {};
  for (const [nodeId, list] of byNode) {
    out[nodeId] = list.map(formatLine).join("\n") + "\n";
  }
  return out;
}

/** Return whether the L1 pool has no entries. */
export async function isL1Empty(): Promise<boolean> {
  await migrateSummaryToPool();
  const path = poolPath();
  if (!(await Bun.file(path).exists())) return true;
  const out = (await $`wc -l < ${path}`.text()).trim();
  const count = Number.parseInt(out, 10);
  return !Number.isFinite(count) || count <= 0;
}

/** Remove only entries whose id ∈ scope. Leaves the rest of the pool. */
export async function clearL1Scope(scope: string[]): Promise<void> {
  const set = new Set(scope);
  const remaining = (await readPoolEntries()).filter((e) => !set.has(e.id));
  await writeFile(
    poolPath(),
    remaining.length ? remaining.map((e) => JSON.stringify(e)).join("\n") + "\n" : "",
    "utf8",
  );
  await renderPresentation(remaining);
}

/** Clear entire L1 pool (legacy helper; prefer clearL1Scope). */
export async function clearL1(): Promise<void> {
  await ensurePoolFile();
  await writeFile(poolPath(), "", "utf8");
  await renderPresentation([]);
}
