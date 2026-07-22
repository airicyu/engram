/** Persistent state for the asynchronous HTTP-triggered dream job. */

import { access, readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "../yaml";
import { homePath } from "./home";

/** Lifecycle states for an asynchronous dream job. */
export type DreamJobStatus = "running" | "completed" | "failed";
/** Pipeline phases recorded for a dream job. */
export type DreamJobPhase = "extract" | "materialize" | "pending_review";

/** Persisted job progress and optional result or error. */
export interface DreamJobState {
  status: DreamJobStatus;
  dream_run_id: string;
  started_at: string;
  completed_at?: string;
  phase?: DreamJobPhase;
  result?: {
    scope: string[];
    patch_count: number;
    superseded: string | null;
    extract_status: string;
    phase: string;
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

/** Read the latest asynchronous dream job, if one exists. */
export async function readDreamJob(): Promise<DreamJobState | null> {
  if (!(await exists(jobPath()))) return null;
  const data = parse(await readFile(jobPath(), "utf8")) as DreamJobState;
  return data ?? null;
}

/** Persist asynchronous dream job state. */
export async function writeDreamJob(state: DreamJobState): Promise<void> {
  await writeFile(jobPath(), stringify(state), "utf8");
}

/** Clear the recorded asynchronous dream job. */
export async function clearDreamJob(): Promise<void> {
  try {
    await writeFile(jobPath(), "", "utf8");
  } catch {
    // already gone
  }
}
