/** Cursor CLI-backed runner for memory ask. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./memory-ask-types";
import { buildAskPrompt, readAskResultFile } from "./memory-ask-invoke";
import {
  registerAgentProcess,
  unregisterAgentProcess,
} from "../store/agent-process";
import { askProcessKey } from "./memory-ask-process";
import { askJobDir } from "../store/memory-ask-job";
import { logMemory, previewText } from "../log";

const PROMPT_PATH = join(import.meta.dir, "../../prompts/memory-ask.md");
const RUNNER = "cursor";

/** Ask via the configured Cursor agent binary with ENGRAM_STORE_DIR attached. */
export class MemoryAskCursorRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const promptTemplate = await readFile(PROMPT_PATH, "utf8");
    const prompt = buildAskPrompt(promptTemplate, input);
    const jobDir = askJobDir(input.job_id);

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

    const { ENGRAM_STORE_DIR: _omit, ...agentEnv } = process.env;
    const started = performance.now();
    const proc = Bun.spawn(cmd, {
      cwd: input.store_dir,
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
          `agent exit ${exitCode}: ${stderr.slice(0, 2000) || stdout.slice(0, 500)}`,
        );
      }

      try {
        return await readAskResultFile(input.job_id);
      } catch (e) {
        if (e instanceof Error && e.message === "ask result file missing") {
          logMemory("ask result file missing after agent exit", {
            job_id: input.job_id,
            stdout_preview: previewText(stdout),
            stderr_preview: previewText(stderr),
          });
        }
        throw e;
      }
    } finally {
      unregisterAgentProcess(key);
    }
  }
}
