/** Persistent state for asynchronous memory ask jobs. */

import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "../../yaml";
import { homePath } from "../home";
import { makeRunId } from "../run-id";
import { nowIso } from "../memories/activities";

/** Lifecycle states for a memory ask job. */
export type AskJobStatus = "running" | "completed" | "failed" | "cancelled";

/** Pipeline phases recorded for an ask job. */
export type AskJobPhase = "prepare" | "agent" | "parse";

/** One citation returned by the ask agent. */
export interface AskSource {
  kind: string;
  node?: string;
  day_id?: string;
  reason?: string;
}

/** Persisted ask job progress and optional result. */
export interface AskJobState {
  job_id: string;
  status: AskJobStatus;
  q: string;
  started_at: string;
  completed_at?: string | null;
  phase?: AskJobPhase;
  agent_pid?: number | null;
  answer?: string | null;
  sources?: AskSource[];
  confidence?: string | null;
  error?: string | null;
}

const KEEP_JOBS = 5;

function jobsRoot(): string {
  return homePath("tmp", "ask", "jobs");
}

/** Job workspace directory for one ask run. */
export function askJobDir(jobId: string): string {
  return join(jobsRoot(), jobId);
}

function jobPath(jobId: string): string {
  return join(askJobDir(jobId), "job.yaml");
}

/** Absolute path to the agent-written ask result JSON for a job. */
export function askResultPath(jobId: string): string {
  return join(askJobDir(jobId), "result.json");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Create a collision-resistant ask job identifier. */
export function makeAskJobId(at = nowIso()): string {
  return makeRunId("ask", at);
}

/** Persist ask job state. */
export async function writeAskJob(state: AskJobState): Promise<void> {
  await mkdir(join(jobsRoot(), state.job_id), { recursive: true });
  await writeFile(jobPath(state.job_id), stringify(state), "utf8");
}

/** Read one ask job, if present. */
export async function readAskJob(jobId: string): Promise<AskJobState | null> {
  if (!(await exists(jobPath(jobId)))) return null;
  return parse(await readFile(jobPath(jobId), "utf8")) as AskJobState;
}

/** List all ask jobs sorted by started_at ascending. */
export async function listAskJobs(): Promise<AskJobState[]> {
  const root = jobsRoot();
  if (!(await exists(root))) return [];
  const dirs = await readdir(root, { withFileTypes: true });
  const out: AskJobState[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const job = await readAskJob(d.name);
    if (job) out.push(job);
  }
  out.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return out;
}

/** Return the single running ask job, if any. */
export async function getRunningAskJob(): Promise<AskJobState | null> {
  const jobs = await listAskJobs();
  return jobs.find((j) => j.status === "running") ?? null;
}

/** Update phase on a running ask job. */
export async function updateAskJobPhase(jobId: string, phase: AskJobPhase): Promise<void> {
  const job = await readAskJob(jobId);
  if (!job || job.status !== "running") return;
  await writeAskJob({ ...job, phase });
}

/** Set agent PID after spawn. */
export async function setAskJobAgentPid(jobId: string, agentPid: number): Promise<void> {
  const job = await readAskJob(jobId);
  if (!job) return;
  await writeAskJob({ ...job, agent_pid: agentPid });
}

/** Prune old terminal jobs, keeping the newest KEEP_JOBS. */
export async function pruneOldAskJobs(): Promise<void> {
  const jobs = await listAskJobs();
  const terminal = jobs.filter((j) => j.status !== "running");
  if (terminal.length <= KEEP_JOBS) return;
  const toRemove = terminal.slice(0, terminal.length - KEEP_JOBS);
  for (const j of toRemove) {
    await rm(join(jobsRoot(), j.job_id), { recursive: true, force: true });
  }
}
