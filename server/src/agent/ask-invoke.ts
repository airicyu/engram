/** Shared ask prompt + result-file read for all runners. */

import { access, readFile } from "node:fs/promises";
import type { AskAnswer, AskInput } from "./ask-types";
import { parseAskOutput } from "./ask-parse";
import { askResultPath } from "../store/tmp/ask-job";
import { logMemoryDebug, previewText } from "../log";

/** Future-sight rows + rules for the ask prompt (hot always; later only when flagged). */
export function buildFutureSightPromptParts(includeLater: boolean): {
  map_rows: string;
  rules: string;
} {
  if (includeLater) {
    return {
      map_rows: [
        "| Future-sight (hot) | `memories/future-sight/hot.md` — near-horizon anchors |",
        "| Future-sight (later) | `memories/future-sight/later.md` — farther anchors within the admission window |",
      ].join("\n"),
      rules: [
        "You **may and should** read both `memories/future-sight/hot.md` and `memories/future-sight/later.md` when the question involves deadlines, launches, schedules, or other near／mid-horizon plans.",
        "Synthesize future-sight with short-term／L2／chain — do **not** answer schedule questions from guesswork alone.",
      ].join(" "),
    };
  }
  return {
    map_rows:
      "| Future-sight (hot) | `memories/future-sight/hot.md` — near-horizon anchors |",
    rules: [
      "You **may** read `memories/future-sight/hot.md` when the question involves near-horizon deadlines／schedules.",
      "Do **not** read `memories/future-sight/later.md` for this job (`include_later` is false).",
      "Synthesize allowed future-sight with short-term／L2／chain — do **not** answer schedule questions from guesswork alone.",
    ].join(" "),
  };
}

/** Build the memory-ask prompt with job-specific paths. */
export function buildAskPrompt(template: string, input: AskInput): string {
  const fsParts = buildFutureSightPromptParts(input.include_later);
  return template
    .replaceAll("{{ENGRAM_STORE_DIR}}", input.store_dir)
    .replaceAll("{{RESULT_PATH}}", askResultPath(input.job_id))
    .replaceAll("{{QUESTION}}", input.q)
    .replaceAll("{{JOB_ID}}", input.job_id)
    .replaceAll("{{TIMEZONE}}", input.timezone)
    .replaceAll("{{MEMORY_LANGUAGE}}", input.memory_language)
    .replaceAll("{{DREAM_STATUS}}", input.dream_status)
    .replaceAll("{{TODAY}}", input.today)
    .replaceAll("{{NOW}}", input.now)
    .replaceAll("{{INCLUDE_LATER}}", input.include_later ? "true" : "false")
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
