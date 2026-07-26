/** Cursor CLI-backed runner for extracting dream patches. */

import { join } from "node:path";
import { config } from "../config";
import type { AgentRunner, ExtractContext } from "./types";
import type { Patch } from "../dream/schema";
import { parseAgentExtractOutput } from "../dream/schema";
import {
  logAgentResult,
  logAgentSpawn,
  logExtractParseFailed,
  logExtractParsed,
} from "./extract-log";
import { setDreamJobAgentPid } from "../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "./prompt-template";
import { withTempJsonContext } from "./temp-context";
import { runAgentCommand } from "./subprocess";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/extract.md");
const RUNNER = "cursor";

/** Extract patches by invoking the configured Cursor agent binary. */
export class CursorCliRunner implements AgentRunner {
  async extract(ctx: ExtractContext): Promise<Patch[]> {
    const promptTemplate = await loadPrompt(PROMPT_PATH);
    const procKey = `dream:${ctx.dream_run_id}`;

    return withTempJsonContext(
      { prefix: "engram-extract", filename: "extract-context.json", value: ctx },
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
        });

        const cmd = [
          config.cursorAgentBin,
          "-p",
          prompt,
          "--output-format",
          "json",
          "--yolo",
          "--add-dir",
          workDir,
        ];

        logAgentSpawn({
          ...meta,
          cmd: [
            config.cursorAgentBin,
            "-p",
            "<prompt>",
            "--output-format",
            "json",
            "--yolo",
            "--add-dir",
            workDir,
          ],
        });

        const result = await runAgentCommand({
          cmd,
          cwd: workDir,
          processKey: procKey,
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "agent",
        });

        logAgentResult(meta, {
          exit_code: result.exitCode,
          duration_ms: result.durationMs,
          stdout: result.stdout,
          stderr: result.stderr,
        });

        try {
          const patches = parseAgentExtractOutput(result.stdout);
          logExtractParsed(ctx.dream_run_id, patches);
          return patches;
        } catch (e) {
          logExtractParseFailed(ctx.dream_run_id, RUNNER, result.stdout, e);
          throw e;
        }
      },
    );
  }
}
