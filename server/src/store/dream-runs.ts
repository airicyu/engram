/** Persistent metadata, reports, and draft paths for dream runs. */

import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "../yaml";
import { homePath } from "./home";
import { nowIso } from "./events";

/** Lifecycle state of a persisted dream run. */
export type DreamRunStatus = "pending" | "committed" | "superseded" | "discarded";

/** Metadata persisted for a dream run and its review outcome. */
export interface DreamRunState {
  id: string;
  status: DreamRunStatus;
  scope: string[];
  created_at: string;
  committed_at?: string;
  superseded_by?: string;
  /** Commit succeeded but clearing L1 scope failed — retry clear on next approve. */
  l1_clear_pending?: boolean;
  patch_count: number;
  report_path: string;
}

function runsDir(): string {
  return homePath("dream", "runs");
}

function runPath(id: string): string {
  return join(runsDir(), `${id}.yaml`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Ensure directories used for dream runs, drafts, and reports exist. */
export async function ensureDreamDirs(): Promise<void> {
  await mkdir(runsDir(), { recursive: true });
  await mkdir(homePath("dream", "draft"), { recursive: true });
  await mkdir(homePath("dream", "reports"), { recursive: true });
}

/** Persist dream-run metadata. */
export async function writeDreamRun(state: DreamRunState): Promise<void> {
  await ensureDreamDirs();
  await writeFile(runPath(state.id), stringify(state), "utf8");
}

/** Read metadata for one dream run. */
export async function readDreamRun(id: string): Promise<DreamRunState | null> {
  const p = runPath(id);
  if (!(await exists(p))) return null;
  return parse(await readFile(p, "utf8")) as DreamRunState;
}

/** List all persisted dream runs. */
export async function listDreamRuns(): Promise<DreamRunState[]> {
  await ensureDreamDirs();
  const entries = await readdir(runsDir(), { withFileTypes: true });
  const out: DreamRunState[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".yaml")) continue;
    const data = parse(await readFile(join(runsDir(), e.name), "utf8")) as DreamRunState;
    if (data?.id) out.push(data);
  }
  return out;
}

/** The unique active pending run, if any. */
export async function getPendingRun(): Promise<DreamRunState | null> {
  const runs = await listDreamRuns();
  const pending = runs.filter((r) => r.status === "pending");
  if (pending.length === 0) return null;
  // Prefer newest by created_at
  pending.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return pending[pending.length - 1] ?? null;
}

/** Run awaiting L1 scope clear after successful commit. */
export async function getL1ClearPendingRun(): Promise<DreamRunState | null> {
  const runs = await listDreamRuns();
  const found = runs.filter((r) => r.status === "committed" && r.l1_clear_pending);
  if (found.length === 0) return null;
  found.sort((a, b) => (a.committed_at ?? "").localeCompare(b.committed_at ?? ""));
  return found[found.length - 1] ?? null;
}

/** Supersede the active pending run before starting a newer one. */
export async function supersedePending(newRunId: string): Promise<DreamRunState | null> {
  const pending = await getPendingRun();
  if (!pending) return null;
  pending.status = "superseded";
  pending.superseded_by = newRunId;
  await writeDreamRun(pending);
  await removeDraft(pending.id);
  return pending;
}

/** Mark the pending run discarded and remove its draft. */
export async function discardPending(dreamRunId?: string): Promise<DreamRunState | null> {
  const pending = await getPendingRun();
  if (!pending) return null;
  if (dreamRunId && pending.id !== dreamRunId) {
    throw new DreamRunMismatchError(pending.id, dreamRunId);
  }
  pending.status = "discarded";
  await writeDreamRun(pending);
  await removeDraft(pending.id);
  return pending;
}

/** Indicates a request targeting a different dream run than the active one. */
export class DreamRunMismatchError extends Error {
  expected: string;
  got: string;
  constructor(expected: string, got: string) {
    super(`dream_run_id mismatch: expected ${expected}, got ${got}`);
    this.name = "DreamRunMismatchError";
    this.expected = expected;
    this.got = got;
  }
}

/** Resolve the draft directory for a dream run. */
export function draftDir(dreamRunId: string): string {
  return homePath("dream", "draft", dreamRunId);
}

/** Resolve the review report path for a dream run. */
export function reportPath(dreamRunId: string): string {
  return homePath("dream", "reports", `${dreamRunId}.md`);
}

/** Remove a dream run's draft projection. */
export async function removeDraft(dreamRunId: string): Promise<void> {
  const dir = draftDir(dreamRunId);
  if (await exists(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Write the markdown review report for a dream run. */
export async function writeReport(dreamRunId: string, markdown: string): Promise<void> {
  await ensureDreamDirs();
  await writeFile(reportPath(dreamRunId), markdown.endsWith("\n") ? markdown : markdown + "\n", "utf8");
}

/** Read a dream run's review report, if present. */
export async function readReport(dreamRunId: string): Promise<string | null> {
  const p = reportPath(dreamRunId);
  if (!(await exists(p))) return null;
  return readFile(p, "utf8");
}

/** Construct metadata for a newly pending dream run. */
export function newPendingRun(opts: {
  id: string;
  scope: string[];
  patch_count: number;
}): DreamRunState {
  return {
    id: opts.id,
    status: "pending",
    scope: opts.scope,
    created_at: nowIso(),
    patch_count: opts.patch_count,
    report_path: `dream/reports/${opts.id}.md`,
  };
}
