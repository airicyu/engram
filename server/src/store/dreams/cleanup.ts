/** Dream staging artifact sweep: orphan drafts, crash recovery, TTL for old reports/events. */

import { access, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config";
import { logInfo } from "../../log";
import { breakStaleLock, isLockStale, isLocked, releaseLock } from "./lock";
import { readDreamJob, writeDreamJob } from "./dream-job";
import {
  getPendingRun,
  listDreamRuns,
  removeDraft,
  type DreamRunState,
} from "./dream-runs";
import { pruneAskHistory } from "./ask-history";
import { writeExtractState } from "./extract-state";
import { nowIso } from "../memories/activities";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DreamCleanupOptions {
  /** Log actions without deleting. */
  dryRun?: boolean;
  /** discarded/superseded/orphan TTL; 0 = skip staging TTL. */
  stagingRetentionDays?: number;
  /** committed report/events TTL; -1 = keep forever. */
  committedReportRetentionDays?: number;
  /** Never TTL-delete artifacts newer than this (safety buffer). */
  minAgeDays?: number;
}

export interface DreamCleanupResult {
  dry_run: boolean;
  orphan_drafts_removed: string[];
  stale_job_recovered: boolean;
  stale_lock_broken: boolean;
  reports_removed: string[];
  event_dirs_removed: string[];
  run_yamls_removed: string[];
  input_jsons_removed: string[];
  ask_history_removed: string[];
}

function storePath(...parts: string[]): string {
  return join(config.storeDir, ...parts);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runAgeMs(run: DreamRunState, now: number): number {
  const ts = run.committed_at ?? run.created_at;
  return now - new Date(ts).getTime();
}

async function fileAgeMs(path: string, now: number): Promise<number> {
  const st = await stat(path);
  return now - st.mtimeMs;
}

async function listDraftRunIds(): Promise<string[]> {
  const draftRoot = storePath("dreams", "draft");
  if (!(await pathExists(draftRoot))) return [];
  const entries = await readdir(draftRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function removePath(path: string, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  await rm(path, { recursive: true, force: true });
}

async function resetExtractStateAfterRecovery(): Promise<void> {
  const runs = await listDreamRuns();
  const committed = runs
    .filter((r) => r.status === "committed")
    .sort((a, b) => (a.committed_at ?? "").localeCompare(b.committed_at ?? ""));
  const last = committed[committed.length - 1];
  if (last) {
    await writeExtractState({ status: "ok", dream_run_id: last.id });
  } else {
    await writeExtractState({ status: "never" });
  }
}

async function recoverStaleDreamJob(dryRun: boolean): Promise<boolean> {
  const job = await readDreamJob();
  if (!job || job.status !== "running") return false;

  const pidOk = job.agent_pid != null && pidAlive(job.agent_pid);
  const lockHeld = await isLocked();
  const lockStale = lockHeld && (await isLockStale());

  if (pidOk && lockHeld && !lockStale) return false;

  if (!dryRun) {
    await removeDraft(job.dream_run_id).catch(() => {});
    if (job.lock_token) {
      await releaseLock(job.lock_token).catch(() => {});
    } else if (lockStale) {
      await breakStaleLock();
    }
    await resetExtractStateAfterRecovery();
    await writeDreamJob({
      ...job,
      status: "failed",
      completed_at: nowIso(),
      agent_pid: null,
      error: "recovered after server restart",
    });
  }

  return true;
}

async function sweepOrphanDrafts(dryRun: boolean): Promise<string[]> {
  const protectedIds = new Set<string>();
  const pending = await getPendingRun();
  if (pending) protectedIds.add(pending.id);
  const job = await readDreamJob();
  if (job?.status === "running") protectedIds.add(job.dream_run_id);

  const removed: string[] = [];
  for (const id of await listDraftRunIds()) {
    if (protectedIds.has(id)) continue;
    removed.push(id);
    if (!dryRun) await removeDraft(id);
  }
  return removed;
}

async function sweepStaleLock(dryRun: boolean): Promise<boolean> {
  if (!(await isLocked()) || !(await isLockStale())) return false;
  if (dryRun) return true;
  return breakStaleLock();
}

function skipTtl(run: DreamRunState, pendingId: string | null): boolean {
  if (pendingId != null && run.id === pendingId) return true;
  if (run.status === "pending") return true;
  if (run.l1_clear_pending === true) return true;
  return false;
}

async function removeYamlAndInput(
  runId: string,
  dryRun: boolean,
  run_yamls_removed: string[],
  input_jsons_removed: string[],
): Promise<void> {
  const yamlPath = storePath("dreams", "runs", `${runId}.yaml`);
  if (await pathExists(yamlPath)) {
    if (!run_yamls_removed.includes(runId)) run_yamls_removed.push(runId);
    await removePath(yamlPath, dryRun);
  }
  const inputPath = storePath("dreams", "runs", `${runId}.input.json`);
  if (await pathExists(inputPath)) {
    if (!input_jsons_removed.includes(runId)) input_jsons_removed.push(runId);
    await removePath(inputPath, dryRun);
  }
}

async function removeRunArtifacts(
  runId: string,
  dryRun: boolean,
  reports_removed: string[],
  event_dirs_removed: string[],
  run_yamls_removed: string[],
  input_jsons_removed: string[],
): Promise<void> {
  const reportPath = storePath("dreams", "reports", `${runId}.md`);
  if (await pathExists(reportPath)) {
    reports_removed.push(runId);
    await removePath(reportPath, dryRun);
  }
  const eventsDir = storePath("dreams", "runs", runId);
  if (await pathExists(eventsDir)) {
    const st = await stat(eventsDir);
    if (st.isDirectory()) {
      event_dirs_removed.push(runId);
      await removePath(eventsDir, dryRun);
    }
  }
  await removeYamlAndInput(runId, dryRun, run_yamls_removed, input_jsons_removed);
}

function pastRetention(ageMs: number, retentionDays: number, minAgeDays: number): boolean {
  if (retentionDays <= 0) return false;
  const retentionMs = retentionDays * MS_PER_DAY;
  const minAgeMs = minAgeDays * MS_PER_DAY;
  return ageMs >= minAgeMs && ageMs >= retentionMs;
}

async function sweepCommittedArtifacts(
  dryRun: boolean,
  committedRetentionDays: number,
  minAgeDays: number,
  now: number,
  pendingId: string | null,
  reports_removed: string[],
  event_dirs_removed: string[],
  run_yamls_removed: string[],
  input_jsons_removed: string[],
): Promise<void> {
  if (committedRetentionDays === -1) return;

  const runs = await listDreamRuns();
  for (const run of runs) {
    if (run.status !== "committed") continue;
    if (skipTtl(run, pendingId)) continue;
    if (!pastRetention(runAgeMs(run, now), committedRetentionDays, minAgeDays)) continue;
    await removeRunArtifacts(
      run.id,
      dryRun,
      reports_removed,
      event_dirs_removed,
      run_yamls_removed,
      input_jsons_removed,
    );
  }
}

async function sweepStagingArtifacts(
  dryRun: boolean,
  stagingRetentionDays: number,
  minAgeDays: number,
  now: number,
  pendingId: string | null,
  reports_removed: string[],
  event_dirs_removed: string[],
  run_yamls_removed: string[],
  input_jsons_removed: string[],
): Promise<void> {
  if (stagingRetentionDays <= 0) return;

  const runs = await listDreamRuns();
  const knownIds = new Set(runs.map((r) => r.id));

  for (const run of runs) {
    if (run.status !== "discarded" && run.status !== "superseded") continue;
    if (skipTtl(run, pendingId)) continue;
    if (!pastRetention(runAgeMs(run, now), stagingRetentionDays, minAgeDays)) continue;
    await removeRunArtifacts(
      run.id,
      dryRun,
      reports_removed,
      event_dirs_removed,
      run_yamls_removed,
      input_jsons_removed,
    );
  }

  const reportsDir = storePath("dreams", "reports");
  if (await pathExists(reportsDir)) {
    for (const name of await readdir(reportsDir)) {
      if (!name.endsWith(".md")) continue;
      const id = name.slice(0, -3);
      if (pendingId === id || knownIds.has(id)) continue;
      const reportPath = join(reportsDir, name);
      const age = await fileAgeMs(reportPath, now);
      if (!pastRetention(age, stagingRetentionDays, minAgeDays)) continue;
      if (!reports_removed.includes(id)) reports_removed.push(id);
      await removePath(reportPath, dryRun);
      await removeYamlAndInput(id, dryRun, run_yamls_removed, input_jsons_removed);
    }
  }

  const runsDir = storePath("dreams", "runs");
  if (await pathExists(runsDir)) {
    for (const entry of await readdir(runsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const id = entry.name;
        if (pendingId === id || knownIds.has(id)) continue;
        const eventsDir = join(runsDir, id);
        const age = await fileAgeMs(eventsDir, now);
        if (!pastRetention(age, stagingRetentionDays, minAgeDays)) continue;
        if (!event_dirs_removed.includes(id)) event_dirs_removed.push(id);
        await removePath(eventsDir, dryRun);
        await removeYamlAndInput(id, dryRun, run_yamls_removed, input_jsons_removed);
        continue;
      }
      if (!entry.isFile()) continue;
      let id: string | null = null;
      if (entry.name.endsWith(".yaml")) id = entry.name.slice(0, -5);
      else if (entry.name.endsWith(".input.json")) id = entry.name.slice(0, -".input.json".length);
      if (!id || pendingId === id || knownIds.has(id)) continue;
      const filePath = join(runsDir, entry.name);
      const age = await fileAgeMs(filePath, now);
      if (!pastRetention(age, stagingRetentionDays, minAgeDays)) continue;
      await removeYamlAndInput(id, dryRun, run_yamls_removed, input_jsons_removed);
    }
  }
}

let lastCleanupResult: DreamCleanupResult | null = null;

/** Last sweep result (startup, cron, or CLI); exposed on GET /status. */
export function getLastDreamCleanupResult(): DreamCleanupResult | null {
  return lastCleanupResult;
}

/**
 * Sweep dream staging artifacts.
 * Recovery always runs; TTL uses separate staging vs committed retention settings.
 */
export async function sweepDreamArtifacts(
  opts: DreamCleanupOptions = {},
): Promise<DreamCleanupResult> {
  const dryRun = opts.dryRun ?? false;
  const stagingRetentionDays =
    opts.stagingRetentionDays ?? config.dreamStagingRetentionDays;
  const committedReportRetentionDays =
    opts.committedReportRetentionDays ?? config.dreamCommittedReportRetentionDays;
  const minAgeDays = opts.minAgeDays ?? config.dreamCleanupMinAgeDays;

  const stale_job_recovered = await recoverStaleDreamJob(dryRun);
  const orphan_drafts_removed = await sweepOrphanDrafts(dryRun);
  const stale_lock_broken = await sweepStaleLock(dryRun);

  const reports_removed: string[] = [];
  const event_dirs_removed: string[] = [];
  const run_yamls_removed: string[] = [];
  const input_jsons_removed: string[] = [];
  const now = Date.now();
  const pending = await getPendingRun();
  const pendingId = pending?.id ?? null;

  await sweepCommittedArtifacts(
    dryRun,
    committedReportRetentionDays,
    minAgeDays,
    now,
    pendingId,
    reports_removed,
    event_dirs_removed,
    run_yamls_removed,
    input_jsons_removed,
  );
  await sweepStagingArtifacts(
    dryRun,
    stagingRetentionDays,
    minAgeDays,
    now,
    pendingId,
    reports_removed,
    event_dirs_removed,
    run_yamls_removed,
    input_jsons_removed,
  );
  const ask_history_removed = await pruneAskHistory(dryRun);

  const result: DreamCleanupResult = {
    dry_run: dryRun,
    orphan_drafts_removed,
    stale_job_recovered,
    stale_lock_broken,
    reports_removed,
    event_dirs_removed,
    run_yamls_removed,
    input_jsons_removed,
    ask_history_removed,
  };

  lastCleanupResult = result;

  const touched =
    orphan_drafts_removed.length > 0 ||
    stale_job_recovered ||
    stale_lock_broken ||
    reports_removed.length > 0 ||
    event_dirs_removed.length > 0 ||
    run_yamls_removed.length > 0 ||
    input_jsons_removed.length > 0 ||
    ask_history_removed.length > 0;

  if (touched) {
    logInfo("dream staging cleanup", {
      dry_run: dryRun,
      orphan_drafts: orphan_drafts_removed.length,
      stale_job_recovered,
      stale_lock_broken,
      reports_removed: reports_removed.length,
      event_dirs_removed: event_dirs_removed.length,
      run_yamls_removed: run_yamls_removed.length,
      input_jsons_removed: input_jsons_removed.length,
      ask_history_removed: ask_history_removed.length,
    });
  }

  return result;
}
