/** Shared ask prompt + result-file read for all runners. */

import { access, readFile } from "node:fs/promises";
import type { AskAnswer, AskInput } from "./memory-ask-types";
import { parseAskOutput } from "./memory-ask-parse";
import { askResultPath } from "../store/memory-ask-job";
import { logMemoryDebug, previewText } from "../log";

/** Build the memory-ask prompt with job-specific paths. */
export function buildAskPrompt(template: string, input: AskInput): string {
  return template
    .replaceAll("{{ENGRAM_HOME}}", input.engram_home)
    .replaceAll("{{RESULT_PATH}}", askResultPath(input.job_id))
    .replaceAll("{{QUESTION}}", input.q)
    .replaceAll("{{JOB_ID}}", input.job_id)
    .replaceAll("{{TIMEZONE}}", input.timezone)
    .replaceAll("{{DREAM_STATUS}}", input.dream_status);
}

/** Read and validate the agent-written result file for a job. */
export async function readAskResultFile(jobId: string): Promise<AskAnswer> {
  const path = askResultPath(jobId);
  try {
    await access(path);
  } catch {
    throw new Error("ask result file missing");
  }

  const raw = await readFile(path, "utf8");
  try {
    return parseAskOutput(raw);
  } catch (e) {
    logMemoryDebug("ask result parse failed", {
      job_id: jobId,
      result_path: path,
      error: e instanceof Error ? e.message : String(e),
      preview: previewText(raw, 800),
    });
    throw e;
  }
}
