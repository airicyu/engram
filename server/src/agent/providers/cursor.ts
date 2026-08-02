/** Cursor CLI AgentInvoker — sole owner of Cursor agent argv (0.20 Phase 7). */

import { config } from "../../config";
import { logAgentResult, logAgentSpawn } from "../shared/log";
import { logMemory, previewText } from "../../log";
import { runAgentCommand } from "../shared/subprocess";
import { cursorWritableAddDirs } from "../shared/write-policy";
import type { AgentInvoker, AgentJob } from "../flow/types";
import { assertRequireFiles, cmdForLog } from "../flow/run-job";

const RUNNER = "cursor";

function logSpawn(job: AgentJob, cmd: string[]): void {
  const dreamRunId = job.logMeta?.dream_run_id;
  if (typeof dreamRunId === "string") {
    logAgentSpawn({
      dream_run_id: dreamRunId,
      runner: RUNNER,
      work_dir: job.cwd,
      cmd: cmdForLog(cmd),
    });
    return;
  }
  logMemory("agent spawn", {
    runner: RUNNER,
    process_key: job.processKey,
    ...(job.logMeta ?? {}),
  });
}

function logResult(
  job: AgentJob,
  result: { exitCode: number; durationMs: number; stdout: string; stderr: string },
): void {
  const dreamRunId = job.logMeta?.dream_run_id;
  if (typeof dreamRunId === "string") {
    logAgentResult(
      {
        dream_run_id: dreamRunId,
        runner: RUNNER,
        work_dir: job.cwd,
      },
      {
        exit_code: result.exitCode,
        duration_ms: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    );
    return;
  }
  logMemory("agent finished", {
    runner: RUNNER,
    process_key: job.processKey,
    exit_code: result.exitCode,
    duration_ms: result.durationMs,
    ...(job.logMeta ?? {}),
  });
}

/**
 * Spawn Cursor agent with yolo + writable roots only (Engram write-policy).
 * OS `--sandbox` defaults to disabled (WSL／old kernels); override via config.
 * Optional `cursorExtraAddDirs` for Read (e.g. store for Ask).
 */
export class CursorInvoker implements AgentInvoker {
  async run(job: AgentJob): Promise<void> {
    const addDirs = cursorWritableAddDirs(job.writePolicy);
    const cmd = [
      config.cursorAgentBin,
      "-p",
      job.prompt,
      "--output-format",
      "json",
      "--sandbox",
      config.cursorSandbox,
      "--yolo",
      "--workspace",
      job.cwd,
    ];
    for (const dir of addDirs) {
      cmd.push("--add-dir", dir);
    }
    for (const dir of job.cursorExtraAddDirs ?? []) {
      if (!addDirs.includes(dir)) {
        cmd.push("--add-dir", dir);
      }
    }

    logSpawn(job, cmd);

    const result = await runAgentCommand({
      cmd,
      cwd: job.cwd,
      processKey: job.processKey,
      onPid: job.onPid,
      exitErrorLabel: job.exitErrorLabel ?? "agent",
    });

    logResult(job, result);

    try {
      await assertRequireFiles(job.requireFiles);
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes("required file is missing") &&
        job.logMeta?.job_id
      ) {
        logMemory("ask result file missing after agent exit", {
          job_id: job.logMeta.job_id,
          stdout_preview: previewText(result.stdout),
          stderr_preview: previewText(result.stderr),
        });
      }
      throw e;
    }
  }
}
