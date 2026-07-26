/** Claude Code-backed runner for memory ask. */

import { join } from "node:path";
import { config } from "../config";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./ask-types";
import { buildAskPrompt, readAskResultFile } from "./ask-invoke";
import { askProcessKey } from "./ask-process";
import { askJobDir, setAskJobAgentPid } from "../store/tmp/ask-job";
import { logMemory } from "../log";
import { loadPrompt } from "./prompt-template";
import { runAgentCommand } from "./subprocess";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/memory-ask.md");
const RUNNER = "claude";

/** Ask via the configured Claude Code binary (read-only store access). */
export class MemoryAskClaudeRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const prompt = buildAskPrompt(promptTemplate, input);
    const jobDir = askJobDir(input.job_id);
    const key = askProcessKey(input.job_id);

    const cmd = [
      config.claudeBin,
      "-p",
      prompt,
      "--output-format",
      "text",
      "--allowedTools",
      "Read,Write",
    ];

    logMemory("agent spawn", { job_id: input.job_id, runner: RUNNER });

    const result = await runAgentCommand({
      cmd,
      cwd: jobDir,
      processKey: key,
      onPid: (pid) => setAskJobAgentPid(input.job_id, pid),
      exitErrorLabel: "claude",
    });

    logMemory("agent finished", {
      job_id: input.job_id,
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
    });

    return readAskResultFile(input.job_id);
  }
}
