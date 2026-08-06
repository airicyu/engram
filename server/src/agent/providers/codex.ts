/** Codex CLI AgentInvoker — sole owner of Codex exec argv (0.23). */

import { config } from "../../config";
import { logAgentResult, logAgentSpawn } from "../shared/log";
import { logMemory, previewText } from "../../log";
import { runAgentCommand } from "../shared/subprocess";
import {
  codexAddDirs,
  codexCdRoot,
  codexNeedsSkipGitRepoCheck,
} from "../shared/write-policy";
import type { AgentInvoker, AgentJob } from "../flow/types";
import { assertRequireFiles, cmdForLog } from "../flow/run-job";

const RUNNER = "codex";

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

/** Build Codex `exec` argv from write-policy (exported for unit tests). */
export function buildCodexCmd(job: AgentJob, bin = config.codexBin): string[] {
  const cd = codexCdRoot(job.writePolicy);
  // Note: `--ask-for-approval` is a top-level `codex` flag, not valid on `codex exec`
  // (Codex CLI ≥0.114). `exec` already defaults to approval never for non-interactive runs.
  const cmd = [bin, "exec", "--sandbox", "workspace-write", "--cd", cd];
  for (const dir of codexAddDirs(job.writePolicy)) {
    cmd.push("--add-dir", dir);
  }
  if (codexNeedsSkipGitRepoCheck(cd)) {
    cmd.push("--skip-git-repo-check");
  }
  cmd.push(job.prompt);
  return cmd;
}

/**
 * Spawn Codex non-interactively with workspace-write + narrow `--cd`
 * (Engram write-policy; see docs/roadmap/0.23.0/).
 */
export class CodexInvoker implements AgentInvoker {
  async run(job: AgentJob): Promise<void> {
    const cmd = buildCodexCmd(job);

    logSpawn(job, cmd);

    const result = await runAgentCommand({
      cmd,
      cwd: job.cwd,
      processKey: job.processKey,
      onPid: job.onPid,
      exitErrorLabel: job.exitErrorLabel ?? "codex",
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
