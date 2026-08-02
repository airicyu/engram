/** Dream domain runner: temp context + render + AgentInvoker (report required). */

import { join } from "node:path";
import type { AgentRunner, DreamContext } from "./types";
import { setDreamJobAgentPid } from "../../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "../shared/prompt-template";
import { withTempJsonContext } from "../shared/temp-context";
import { dreamWritePolicy, formatWritableRoots } from "../shared/write-policy";
import type { AgentInvoker } from "../flow/types";

const PROMPT_PATH = join(import.meta.dir, "../../../prompts/dream-files.md");

/** Edit draft files + report via a shared AgentInvoker. */
export class DreamCliRunner implements AgentRunner {
  constructor(private readonly invoker: AgentInvoker) {}

  async dream(ctx: DreamContext): Promise<void> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const procKey = `dream:${ctx.dream_run_id}`;

    await withTempJsonContext(
      { prefix: "engram-dream", filename: "dream-context.json", value: ctx },
      async (workDir, ctxPath) => {
        const policy = dreamWritePolicy(ctx, [workDir]);
        const prompt = renderPrompt(promptTemplate, {
          CONTEXT_PATH: ctxPath,
          DREAM_RUN_ID: ctx.dream_run_id,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: ctx.memory_language,
          TODAY: ctx.today,
          NOW: ctx.now,
          STORE_DIR: ctx.store_dir,
          DRAFT_DIR: ctx.draft_dir,
          REPORT_PATH: ctx.report_path,
          WRITABLE_ROOTS: formatWritableRoots(policy),
        });

        await this.invoker.run({
          processKey: procKey,
          prompt,
          cwd: workDir,
          writePolicy: policy,
          requireFiles: [ctx.report_path],
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "dream agent",
          logMeta: { dream_run_id: ctx.dream_run_id },
        });
      },
    );
  }
}

/** For tests: no-op dream (caller prepares draft／report). */
export class StaticRunner implements AgentRunner {
  async dream(_ctx: DreamContext): Promise<void> {
    // intentionally empty — fixtures prepare files
  }
}
