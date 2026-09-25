import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { jobsDir, jobPath } from "../config/paths.ts";

export type JobKind = "ingest" | "distill" | "ask";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  input: Record<string, string>;
  output: { text: string } | null;
  error: string | null;
  log: string[];
};

export async function ensureJobsDir() {
  await mkdir(jobsDir(), { recursive: true });
}

export async function saveJob(job: Job) {
  await ensureJobsDir();
  job.updated_at = new Date().toISOString();
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2) + "\n", "utf8");
}

export async function loadJob(id: string): Promise<Job | null> {
  try {
    return JSON.parse(await readFile(jobPath(id), "utf8")) as Job;
  } catch {
    return null;
  }
}

export async function listJobs(): Promise<Job[]> {
  await ensureJobsDir();
  let names: string[];
  try {
    names = await readdir(jobsDir());
  } catch {
    return [];
  }
  const jobs: Job[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const job = await loadJob(name.replace(/\.json$/, ""));
    if (job) jobs.push(job);
  }
  jobs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return jobs.slice(0, 50);
}

export function newJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function failStuckRunning() {
  const jobs = await listJobs();
  for (const job of jobs) {
    if (job.status === "running" || job.status === "queued") {
      job.status = "failed";
      job.error = "server_restarted";
      job.log.push("marked failed after server restart");
      await saveJob(job);
    }
  }
}
