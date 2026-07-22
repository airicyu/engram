/** Claude Code-backed and static dream extraction runners. */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "../config";
import type { AgentRunner, ExtractContext } from "./types";
import type { Patch } from "../dream/schema";
import { parseExtractStdout } from "../dream/schema";
import {
  logAgentResult,
  logAgentSpawn,
  logExtractParseFailed,
  logExtractParsed,
} from "./extract-log";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/extract.md");
const RUNNER = "claude";

/** Extract patches by invoking the configured Claude Code binary. */
export class ClaudeCodeRunner implements AgentRunner {
  async extract(ctx: ExtractContext): Promise<Patch[]> {
    const promptTemplate = await readFile(PROMPT_PATH, "utf8");
    const workDir = join(tmpdir(), `engram-extract-${Date.now()}`);
    await mkdir(workDir, { recursive: true });

    const meta = {
      dream_run_id: ctx.dream_run_id,
      runner: RUNNER,
      work_dir: workDir,
    };

    try {
      const ctxPath = join(workDir, "extract-context.json");
      await writeFile(ctxPath, JSON.stringify(ctx, null, 2), "utf8");

      const prompt = promptTemplate
        .replaceAll("{{CONTEXT_PATH}}", ctxPath)
        .replaceAll("{{DREAM_RUN_ID}}", ctx.dream_run_id)
        .replaceAll("{{TIMEZONE}}", ctx.timezone);

      const cmd = [
        config.claudeBin,
        "-p",
        prompt,
        "--output-format",
        "text",
        "--allowedTools",
        "Read",
      ];
      logAgentSpawn({
        ...meta,
        cmd: [config.claudeBin, "-p", "<prompt>", "--output-format", "text", "--allowedTools", "Read"],
      });

      const { ENGRAM_HOME: _omit, ...agentEnv } = process.env;
      const started = performance.now();
      const proc = Bun.spawn(cmd, {
        cwd: workDir,
        env: agentEnv,
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      logAgentResult(meta, {
        exit_code: exitCode,
        duration_ms: Math.round(performance.now() - started),
        stdout,
        stderr,
      });

      if (exitCode !== 0) {
        throw new Error(
          `claude exit ${exitCode}: ${stderr.slice(0, 2000) || stdout.slice(0, 500)}`,
        );
      }

      try {
        const patches = parseExtractStdout(stdout);
        logExtractParsed(ctx.dream_run_id, patches);
        return patches;
      } catch (e) {
        logExtractParseFailed(ctx.dream_run_id, RUNNER, stdout, e);
        throw e;
      }
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** For tests: inject pre-parsed patches without calling Claude. */
export class StaticRunner implements AgentRunner {
  constructor(private patches: Patch[]) {}
  async extract(_ctx: ExtractContext): Promise<Patch[]> {
    return this.patches.map((p) => ({
      ...p,
      dream_run_id: _ctx.dream_run_id,
    }));
  }
}
