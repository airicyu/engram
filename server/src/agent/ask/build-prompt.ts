/** Shared ask prompt + result-file read for all runners. */

import { access, readFile } from "node:fs/promises";
import { memoryLanguagePromptLabel } from "../../config";
import type { AskAnswer, AskInput } from "./types";
import { parseAskOutput } from "./parse";
import { askResultPath } from "../../store/tmp/ask-job";
import { logMemoryDebug, previewText } from "../../log";

/** Future-sight rows + rules for the ask prompt (upcoming and longTerm always in scope). */
export function buildFutureSightPromptParts(): {
  map_rows: string;
  rules: string;
} {
  return {
    map_rows: [
      "| Future-sight (upcoming) | `memories/future-sight/upcoming.md` — near-horizon anchors |",
      "| Future-sight (longTerm) | `memories/future-sight/longTerm.md` — farther anchors within the admission window |",
    ].join("\n"),
    rules: [
      "You **may** read both `memories/future-sight/upcoming.md` and `memories/future-sight/longTerm.md`.",
      "Decide from the question whether longTerm is relevant: open `longTerm.md` when the question could involve farther plans, deadlines, launches, or schedules — not only the upcoming window.",
      "Skip longTerm when the question clearly has no future-plan aspect.",
      "Do **not** dump every longTerm item into the answer; cite only what you used.",
      "Synthesize future-sight with short-term／L2／chain — do **not** answer schedule questions from guesswork alone.",
    ].join(" "),
  };
}

/** Build the memory-ask prompt with job-specific paths. */
export function buildAskPrompt(template: string, input: AskInput): string {
  const fsParts = buildFutureSightPromptParts();
  return template
    .replaceAll("{{ENGRAM_STORE_DIR}}", input.store_dir)
    .replaceAll("{{RESULT_PATH}}", askResultPath(input.job_id))
    .replaceAll("{{QUESTION}}", input.q)
    .replaceAll("{{JOB_ID}}", input.job_id)
    .replaceAll("{{TIMEZONE}}", input.timezone)
    .replaceAll("{{MEMORY_LANGUAGE}}", memoryLanguagePromptLabel(input.memory_language))
    .replaceAll("{{DREAM_STATUS}}", input.dream_status)
    .replaceAll("{{TODAY}}", input.today)
    .replaceAll("{{NOW}}", input.now)
    .replaceAll("{{FUTURE_SIGHT_MAP_ROWS}}", fsParts.map_rows)
    .replaceAll("{{FUTURE_SIGHT_RULES}}", fsParts.rules);
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
