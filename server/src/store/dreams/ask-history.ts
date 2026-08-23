/** Side-car ask Q&A history under dreams/ (not store git, not memories/). */

import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config";
import type { AskJobState, AskJobStatus, AskSource } from "../tmp/ask-job";
import { getRunningAskJob } from "../tmp/ask-job";

const MS_PER_HOUR = 60 * 60 * 1000;

export type AskHistoryStatus = Exclude<AskJobStatus, "running">;

export interface AskHistoryRecord {
  job_id: string;
  q: string;
  status: AskHistoryStatus;
  started_at: string;
  completed_at: string | null;
  answer: string | null;
  error?: string | null;
  sources?: AskSource[];
}

export interface AskRecentItem {
  job_id: string;
  q: string;
  status: AskJobStatus;
  started_at: string;
  completed_at: string | null;
  answer_preview: string | null;
}

function historyDir(): string {
  return join(config.storeDir, "dreams", "ask-history");
}

function historyPath(jobId: string): string {
  return join(historyDir(), `${jobId}.json`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function answerPreview(answer: string | null | undefined): string | null {
  const trimmed = (answer ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

function isTerminalStatus(status: string): status is AskHistoryStatus {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function recordAgeMs(rec: AskHistoryRecord, now: number): number {
  const ts = rec.completed_at ?? rec.started_at;
  return now - new Date(ts).getTime();
}

function sortKey(a: { started_at: string; job_id: string }, b: { started_at: string; job_id: string }): number {
  const started = b.started_at.localeCompare(a.started_at);
  if (started !== 0) return started;
  return a.job_id.localeCompare(b.job_id);
}

/** Persist a terminal ask job when retention hours > 0. */
export async function persistAskHistory(job: AskJobState): Promise<void> {
  if (config.askHistoryRetentionHours <= 0) return;
  if (!isTerminalStatus(job.status)) return;
  const record: AskHistoryRecord = {
    job_id: job.job_id,
    q: job.q,
    status: job.status,
    started_at: job.started_at,
    completed_at: job.completed_at ?? null,
    answer: job.answer ?? null,
    error: job.error ?? null,
    sources: job.sources ?? [],
  };
  await mkdir(historyDir(), { recursive: true });
  await writeFile(historyPath(job.job_id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function readAskHistory(jobId: string): Promise<AskHistoryRecord | null> {
  const p = historyPath(jobId);
  if (!(await exists(p))) return null;
  try {
    return JSON.parse(await readFile(p, "utf8")) as AskHistoryRecord;
  } catch {
    return null;
  }
}

async function listAskHistoryRecords(): Promise<AskHistoryRecord[]> {
  const dir = historyDir();
  if (!(await exists(dir))) return [];
  const names = await readdir(dir);
  const out: AskHistoryRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const rec = await readAskHistory(name.slice(0, -5));
    if (rec?.job_id) out.push(rec);
  }
  return out;
}

/** TTL then max-entries cap. Does not touch running temp jobs. */
export async function pruneAskHistory(dryRun: boolean): Promise<string[]> {
  const removed: string[] = [];
  const hours = config.askHistoryRetentionHours;
  const maxEntries = config.askHistoryMaxEntries;
  const now = Date.now();
  const records = await listAskHistoryRecords();

  const toDelete = new Set<string>();
  if (hours <= 0) {
    for (const rec of records) toDelete.add(rec.job_id);
  } else {
    const retentionMs = hours * MS_PER_HOUR;
    for (const rec of records) {
      if (recordAgeMs(rec, now) >= retentionMs) toDelete.add(rec.job_id);
    }
  }

  const kept = records.filter((r) => !toDelete.has(r.job_id));
  kept.sort((a, b) => {
    const ta = a.completed_at ?? a.started_at;
    const tb = b.completed_at ?? b.started_at;
    const cmp = ta.localeCompare(tb);
    if (cmp !== 0) return cmp;
    return a.job_id.localeCompare(b.job_id);
  });
  if (kept.length > maxEntries) {
    for (const rec of kept.slice(0, kept.length - maxEntries)) {
      toDelete.add(rec.job_id);
    }
  }

  for (const id of toDelete) {
    removed.push(id);
    if (!dryRun) await rm(historyPath(id), { force: true });
  }
  return removed;
}

function toRecentItem(
  jobId: string,
  q: string,
  status: AskJobStatus,
  started_at: string,
  completed_at: string | null | undefined,
  answer: string | null | undefined,
): AskRecentItem {
  return {
    job_id: jobId,
    q,
    status,
    started_at,
    completed_at: completed_at ?? null,
    answer_preview: answerPreview(answer),
  };
}

/** History files plus running temp job; running wins on id collision. Newest started_at first. */
export async function listAskRecent(): Promise<AskRecentItem[]> {
  const byId = new Map<string, AskRecentItem>();
  for (const rec of await listAskHistoryRecords()) {
    byId.set(
      rec.job_id,
      toRecentItem(rec.job_id, rec.q, rec.status, rec.started_at, rec.completed_at, rec.answer),
    );
  }
  const running = await getRunningAskJob();
  if (running) {
    byId.set(
      running.job_id,
      toRecentItem(
        running.job_id,
        running.q,
        running.status,
        running.started_at,
        running.completed_at,
        running.answer,
      ),
    );
  }
  return [...byId.values()].sort(sortKey);
}
