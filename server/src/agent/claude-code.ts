/** Claude Code-backed dream file-pipeline runner (0.16). */

import { join } from "node:path";
import { access } from "node:fs/promises";
import { config } from "../config";
import type { AgentRunner, DreamContext } from "./types";
import {
  logAgentResult,
  logAgentSpawn,
} from "./extract-log";
import { setDreamJobAgentPid } from "../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "./prompt-template";
import { withTempJsonContext } from "./temp-context";
import { runAgentCommand } from "./subprocess";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/dream-files.md");
const RUNNER = "claude";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Edit draft files + report via Claude Code CLI. */
export class ClaudeCodeRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const procKey = `dream:${ctx.dream_run_id}`;

    await withTempJsonContext(
      { prefix: "engram-dream", filename: "dream-context.json", value: ctx },
      async (workDir, ctxPath) => {
        const meta = {
          dream_run_id: ctx.dream_run_id,
          runner: RUNNER,
          work_dir: workDir,
        };

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
        });

        const cmd = [
          config.claudeBin,
          "-p",
          prompt,
          "--output-format",
          "text",
          "--allowedTools",
          "Read,Write,Edit,Bash",
        ];

        logAgentSpawn({
          ...meta,
          cmd: [
            config.claudeBin,
            "-p",
            "<prompt>",
            "--output-format",
            "text",
            "--allowedTools",
            "Read,Write,Edit,Bash",
          ],
        });

        const result = await runAgentCommand({
          cmd,
          cwd: ctx.store_dir,
          processKey: procKey,
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "claude",
        });

        logAgentResult(meta, {
          exit_code: result.exitCode,
          duration_ms: result.durationMs,
          stdout: result.stdout,
          stderr: result.stderr,
        });

        if (!(await exists(ctx.report_path))) {
          throw new Error("dream agent finished but report file is missing");
        }
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
