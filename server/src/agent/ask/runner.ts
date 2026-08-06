/** Ask domain runner: render prompt → AgentInvoker → read result file. */

import { join } from "node:path";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./types";
import { buildAskPrompt, readAskResultFile } from "./build-prompt";
import { askProcessKey } from "./process";
import { askJobDir, askResultPath, setAskJobAgentPid } from "../../store/tmp/ask-job";
import { loadPrompt } from "../shared/prompt-template";
import { askWritePolicy } from "../shared/write-policy";
import type { AgentInvoker } from "../flow/types";

const PROMPT_PATH = join(import.meta.dir, "../../../prompts/memory-ask.md");

/** Ask via a shared AgentInvoker (Claude／Cursor／Codex). */
export class MemoryAskRunnerImpl implements MemoryAskRunner {
  constructor(private readonly invoker: AgentInvoker) {}

  async ask(input: AskInput): Promise<AskAnswer> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const prompt = buildAskPrompt(promptTemplate, input);
    const jobDir = askJobDir(input.job_id);
    const policy = askWritePolicy(input);
    const resultPath = askResultPath(input.job_id);

    await this.invoker.run({
      processKey: askProcessKey(input.job_id),
      prompt,
      cwd: jobDir,
      writePolicy: policy,
      requireFiles: [resultPath],
      cursorExtraAddDirs: [input.store_dir],
      onPid: (pid) => setAskJobAgentPid(input.job_id, pid),
      exitErrorLabel: "ask agent",
      logMeta: { job_id: input.job_id },
    });

    return readAskResultFile(input.job_id);
  }
}
