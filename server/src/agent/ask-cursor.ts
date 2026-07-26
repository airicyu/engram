/** Cursor CLI-backed runner for memory ask. */

import { join } from "node:path";
import { config } from "../config";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./ask-types";
import { buildAskPrompt, readAskResultFile } from "./ask-invoke";
import { askProcessKey } from "./ask-process";
import { askJobDir, setAskJobAgentPid } from "../store/tmp/ask-job";
import { logMemory, previewText } from "../log";
import { loadPrompt } from "./prompt-template";
import { runAgentCommand } from "./subprocess";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/memory-ask.md");
const RUNNER = "cursor";

/** Ask via the configured Cursor agent binary with ENGRAM_STORE_DIR attached. */
export class MemoryAskCursorRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const prompt = buildAskPrompt(promptTemplate, input);
    const jobDir = askJobDir(input.job_id);
    const key = askProcessKey(input.job_id);

    // Do NOT use --mode ask: Cursor documents it as read-only (no Write tool).
    const cmd = [
      config.cursorAgentBin,
      "-p",
      prompt,
      "--yolo",
      "--add-dir",
      input.store_dir,
      "--add-dir",
      jobDir,
    ];

    logMemory("agent spawn", { job_id: input.job_id, runner: RUNNER });

    const result = await runAgentCommand({
      cmd,
      cwd: input.store_dir,
      processKey: key,
      onPid: (pid) => setAskJobAgentPid(input.job_id, pid),
      exitErrorLabel: "agent",
    });

    logMemory("agent finished", {
      job_id: input.job_id,
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
    });

    try {
      return await readAskResultFile(input.job_id);
    } catch (e) {
      if (e instanceof Error && e.message === "ask result file missing") {
        logMemory("ask result file missing after agent exit", {
          job_id: input.job_id,
          stdout_preview: previewText(result.stdout),
          stderr_preview: previewText(result.stderr),
        });
      }
      throw e;
    }
  }
}
