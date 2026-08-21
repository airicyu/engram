/** Claude Code AgentInvoker — sole owner of Claude CLI argv (0.20 Phase 7). */

import { config } from "../../config";
import { logAgentResult, logAgentSpawn } from "../shared/log";
import { logMemory } from "../../log";
import { runAgentCommand } from "../shared/subprocess";
import {
  claudeAllowedToolsForWrites,
  claudeDisallowedTools,
} from "../shared/write-policy";
import type { AgentInvoker, AgentJob } from "../flow/types";
import { assertRequireFiles, cmdForLog } from "../flow/run-job";

const RUNNER = "claude";

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

/** Spawn Claude Code with write-policy scoped Edit tools (no Bash). */
export class ClaudeInvoker implements AgentInvoker {
  async run(job: AgentJob): Promise<void> {
    const policy = job.writePolicy;
    const allowedTools = claudeAllowedToolsForWrites(policy);
    const disallowedTools = claudeDisallowedTools(policy);

    const cmd = [
      config.claudeBin,
      "-p",
      job.prompt,
      "--output-format",
      "text",
      "--add-dir",
      policy.storeDir,
    ];
    for (const root of policy.writableRoots) {
      if (root !== policy.storeDir) {
        cmd.push("--add-dir", root);
      }
    }
    cmd.push("--allowedTools", allowedTools, "--disallowedTools", disallowedTools);

    logSpawn(job, cmd);

    const result = await runAgentCommand({
      cmd,
      cwd: job.cwd,
      processKey: job.processKey,
      onPid: job.onPid,
      exitErrorLabel: job.exitErrorLabel ?? "claude",
    });

    logResult(job, result);
    await assertRequireFiles(job.requireFiles);
  }
}
