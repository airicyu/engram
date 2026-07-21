import { access, readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { homePath } from "./home";

export type DreamJobStatus = "running" | "completed" | "failed";

export interface DreamJobState {
  status: DreamJobStatus;
  dream_run_id: string;
  started_at: string;
  completed_at?: string;
  result?: {
    applied: string[];
    skipped: string[];
    dead_letter: string[];
    extract_status: string;
    resumed: boolean;
  };
  error?: string;
}

function jobPath(): string {
  return homePath("dream", "dream-job.yaml");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readDreamJob(): Promise<DreamJobState | null> {
  if (!(await exists(jobPath()))) return null;
  const data = parse(await readFile(jobPath(), "utf8")) as DreamJobState;
  return data ?? null;
}

export async function writeDreamJob(state: DreamJobState): Promise<void> {
  await writeFile(jobPath(), stringify(state), "utf8");
}

export async function clearDreamJob(): Promise<void> {
  try {
    await writeFile(jobPath(), "", "utf8");
  } catch {
    // already gone
  }
}