/** CLI clarify distill／generate agents (file deliverables via AgentInvoker). */

import { join } from "node:path";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { config } from "../../config";
import { setDreamJobAgentPid } from "../../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "../shared/prompt-template";
import { withTempJsonContext } from "../shared/temp-context";
import { rollupWritePolicy } from "../shared/write-policy";
import type { AgentInvoker } from "../flow/types";
import { parse } from "../../yaml";
import type {
  ClarifyDistillAgent,
  ClarifyDistillContext,
  ClarifyDistillResult,
  ClarifyGenerateAgent,
  ClarifyGenerateContext,
  ClarifyGenerateResult,
} from "./types";

function normRoot(p: string): string {
  return resolve(p);
}

async function readRequiredJson(path: string, label: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(`${label}: missing result file ${path}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // YAML fallback
    return parse(raw);
  }
}

export class CliClarifyDistillAgent implements ClarifyDistillAgent {
  constructor(private readonly invoker: AgentInvoker) {}

  async distill(ctx: ClarifyDistillContext): Promise<ClarifyDistillResult> {
    const promptPath = join(import.meta.dir, "../../../prompts/clarify-distill.md");
    const template = await loadPrompt(promptPath);
    return withTempJsonContext(
      {
        prefix: "engram-clarify-distill",
        filename: "distill-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const resultPath = join(workDir, "distill-result.json");
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          RESULT_PATH: resultPath,
          DRAFT_DIR: ctx.draft_dir,
          DREAM_RUN_ID: ctx.dream_run_id,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: ctx.memory_language,
        });
        // Writable: only draft node tree + workDir (result json). Never chain／future／live.
        const nodesRoot = join(ctx.draft_dir, "memories", "nodes");
        const policy = {
          storeDir: normRoot(ctx.store_dir),
          writableRoots: [normRoot(nodesRoot), normRoot(workDir)],
          readableRoots: [
            normRoot(ctx.store_dir),
            normRoot(ctx.draft_dir),
            normRoot(workDir),
          ],
        };
        await this.invoker.run({
          processKey: `dream:${ctx.dream_run_id}`,
          prompt,
          cwd: workDir,
          writePolicy: policy,
          requireFiles: [resultPath],
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "clarify distill agent",
          logMeta: { dream_run_id: ctx.dream_run_id },
        });
        const doc = (await readRequiredJson(resultPath, "clarify distill")) as {
          distilled_node_ids?: unknown;
          narrative?: unknown;
        };
        const ids = Array.isArray(doc.distilled_node_ids)
          ? doc.distilled_node_ids.filter((x): x is string => typeof x === "string" && !!x.trim())
          : [];
        const narrative = typeof doc.narrative === "string" ? doc.narrative : undefined;
        return { distilled_node_ids: [...new Set(ids)].sort(), narrative };
      },
    );
  }
}

export class CliClarifyGenerateAgent implements ClarifyGenerateAgent {
  constructor(private readonly invoker: AgentInvoker) {}

  async generate(ctx: ClarifyGenerateContext): Promise<ClarifyGenerateResult> {
    const promptPath = join(import.meta.dir, "../../../prompts/clarify-generate.md");
    const template = await loadPrompt(promptPath);
    return withTempJsonContext(
      {
        prefix: "engram-clarify-generate",
        filename: "generate-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const resultPath = join(workDir, "generate-result.json");
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          RESULT_PATH: resultPath,
          WORK_DIR: ctx.work_dir,
          DREAM_RUN_ID: ctx.dream_run_id,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: ctx.memory_language,
          GENERATE_MIN: String(ctx.generate_min),
          GENERATE_MAX: String(ctx.generate_max),
          ASKING_CAP: String(ctx.asking_cap),
        });
        // Only temp work dirs — never live memories/clarify
        const policy = rollupWritePolicy({
          storeDir: config.storeDir,
          workDir: ctx.work_dir,
        });
        // Also allow withTempJsonContext workDir
        const writePolicy = {
          ...policy,
          writableRoots: [...new Set([...policy.writableRoots, workDir])],
        };
        await this.invoker.run({
          processKey: `dream:${ctx.dream_run_id}`,
          prompt,
          cwd: workDir,
          writePolicy,
          requireFiles: [resultPath],
          onPid: (pid) => setDreamJobAgentPid(pid),
          exitErrorLabel: "clarify generate agent",
          logMeta: { dream_run_id: ctx.dream_run_id },
        });
        const doc = (await readRequiredJson(resultPath, "clarify generate")) as {
          prompts?: unknown;
          prune_asking_ids?: unknown;
        };
        const prompts: ClarifyGenerateResult["prompts"] = [];
        if (Array.isArray(doc.prompts)) {
          for (const p of doc.prompts) {
            if (!p || typeof p !== "object") continue;
            const q = (p as { question?: unknown }).question;
            if (typeof q !== "string" || !q.trim()) continue;
            const related = (p as { related_nodes?: unknown }).related_nodes;
            prompts.push({
              question: q.trim(),
              related_nodes: Array.isArray(related)
                ? related.filter((x): x is string => typeof x === "string")
                : [],
            });
          }
        }
        const prune = Array.isArray(doc.prune_asking_ids)
          ? doc.prune_asking_ids.filter((x): x is string => typeof x === "string")
          : undefined;
        return { prompts, prune_asking_ids: prune };
      },
    );
  }
}
