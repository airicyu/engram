/** Claude Code-backed runner for memory ask. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./memory-ask-types";
import { buildAskPrompt, readAskResultFile } from "./memory-ask-invoke";
import { registerAgentProcess, unregisterAgentProcess } from "../store/agent-process";
import { askProcessKey } from "./memory-ask-process";
import { askJobDir } from "../store/memory-ask-job";
import { logMemory } from "../log";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/memory-ask.md");
const RUNNER = "claude";

/** Ask via the configured Claude Code binary (read-only store access). */
export class MemoryAskClaudeRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const promptTemplate = await readFile(PROMPT_PATH, "utf8");
    const prompt = buildAskPrompt(promptTemplate, input);
    const jobDir = askJobDir(input.job_id);

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

    const { ENGRAM_HOME: _omit, ...agentEnv } = process.env;
    const started = performance.now();
    const proc = Bun.spawn(cmd, {
      cwd: jobDir,
      env: agentEnv,
      stdout: "pipe",
      stderr: "pipe",
    });

    const key = askProcessKey(input.job_id);
    const pid = registerAgentProcess(key, proc);
    if (pid != null) {
      const { setAskJobAgentPid } = await import("../store/memory-ask-job");
      await setAskJobAgentPid(input.job_id, pid);
    }

    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      logMemory("agent finished", {
        job_id: input.job_id,
        exit_code: exitCode,
        duration_ms: Math.round(performance.now() - started),
      });

      if (exitCode !== 0) {
        throw new Error(
          `claude exit ${exitCode}: ${stderr.slice(0, 2000) || stdout.slice(0, 500)}`,
        );
      }

      return readAskResultFile(input.job_id);
    } finally {
      unregisterAgentProcess(key);
    }
  }
}
