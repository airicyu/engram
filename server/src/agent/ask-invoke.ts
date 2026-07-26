/** Shared ask prompt + result-file read for all runners. */

import { access, readFile } from "node:fs/promises";
import type { AskAnswer, AskInput } from "./ask-types";
import { parseAskOutput } from "./ask-parse";
import { askResultPath } from "../store/tmp/ask-job";
import { logMemoryDebug, previewText } from "../log";

/** Build the memory-ask prompt with job-specific paths. */
export function buildAskPrompt(template: string, input: AskInput): string {
  return template
    .replaceAll("{{ENGRAM_STORE_DIR}}", input.store_dir)
    .replaceAll("{{RESULT_PATH}}", askResultPath(input.job_id))
    .replaceAll("{{QUESTION}}", input.q)
    .replaceAll("{{JOB_ID}}", input.job_id)
    .replaceAll("{{TIMEZONE}}", input.timezone)
    .replaceAll("{{MEMORY_LANGUAGE}}", input.memory_language)
    .replaceAll("{{DREAM_STATUS}}", input.dream_status)
    .replaceAll("{{TODAY}}", input.today)
    .replaceAll("{{NOW}}", input.now);
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
