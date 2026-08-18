/** File-deliverable CLI agents for higher-chain rollup planner／writer (Phase 7 invoker). */

import { join } from "node:path";
import { config, memoryLanguagePromptLabel } from "../../config";
import type {
  RollupAgent,
  RollupPlan,
  RollupPlanContext,
  RollupWriteContext,
} from "../../dream/rollup/cascade";
import {
  isCurrentMonth,
  isCurrentWeek,
  isCurrentYear,
} from "../../store/memories/chain-time";
import { draftDir } from "../../store/dreams/dream-runs";
import { setDreamJobAgentPid } from "../../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "../shared/prompt-template";
import { withTempJsonContext } from "../shared/temp-context";
import { rollupWritePolicy } from "../shared/write-policy";
import type { AgentInvoker } from "../flow/types";
import { parsePlanJson, readRequiredFile, stripRollupWriterPreamble } from "./parse";

export { MockRollupAgent, fuseMockNarrative } from "./mock";
export { stripRollupWriterPreamble, parsePlanJson } from "./parse";

/** Shared plan／write flow via AgentInvoker; deliverables are files. */
export class CliRollupAgent implements RollupAgent {
  constructor(private readonly invoker: AgentInvoker) {}

  async plan(ctx: RollupPlanContext): Promise<RollupPlan> {
    const promptPath = join(import.meta.dir, "../../../prompts/rollup-plan.md");
    const template = await loadPrompt(promptPath);
    return withTempJsonContext(
      {
        prefix: "engram-rollup-plan",
        filename: "plan-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const resultPath = join(workDir, "plan.json");
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          RESULT_PATH: resultPath,
          DREAM_RUN_ID: ctx.dream_run_id,
          LEVEL: ctx.level,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: memoryLanguagePromptLabel(ctx.memory_language),
        });
        const policy = rollupWritePolicy({
          storeDir: config.storeDir,
          workDir,
        });
        await this.invoker.run({
          processKey: `dream:${ctx.dream_run_id}`,
          prompt,
          cwd: workDir,
          writePolicy: policy,
          requireFiles: [resultPath],
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "rollup agent",
          logMeta: { dream_run_id: ctx.dream_run_id },
        });
        const raw = await readRequiredFile(resultPath, "rollup plan");
        return parsePlanJson(raw);
      },
    );
  }

  async write(ctx: RollupWriteContext): Promise<string> {
    const promptPath = join(
      import.meta.dir,
      `../../../prompts/rollup-write-${ctx.level}.md`,
    );
    const template = await loadPrompt(promptPath);
    const draftRoot = draftDir(ctx.dream_run_id);
    return withTempJsonContext(
      {
        prefix: "engram-rollup-write",
        filename: "write-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          OUTPUT_PATH: ctx.output_path,
          OUTPUT_REL: ctx.output_rel,
          DREAM_RUN_ID: ctx.dream_run_id,
          LEVEL: ctx.level,
          ID: ctx.id,
          OPERATION: ctx.operation,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: memoryLanguagePromptLabel(ctx.memory_language),
        });
        const policy = rollupWritePolicy({
          storeDir: config.storeDir,
          workDir,
          draftDir: draftRoot,
        });
        await this.invoker.run({
          processKey: `dream:${ctx.dream_run_id}`,
          prompt,
          cwd: workDir,
          writePolicy: policy,
          requireFiles: [ctx.output_path],
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "rollup agent",
          logMeta: { dream_run_id: ctx.dream_run_id },
        });
        const raw = await readRequiredFile(ctx.output_path, "rollup write");
        return stripRollupWriterPreamble(raw);
      },
    );
  }
}

/** Heuristic used only in docs/tests — mirrors mock planner flags. */
export function periodIsCurrent(
  level: "week" | "month" | "year",
  id: string,
  today: string,
): boolean {
  if (level === "week") return isCurrentWeek(id, today);
  if (level === "month") return isCurrentMonth(id, today);
  return isCurrentYear(id, today);
}
