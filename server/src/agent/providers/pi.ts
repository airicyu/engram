/** Pi coding-agent AgentInvoker — sole owner of `pi -p` argv (0.46). */

import { join } from "node:path";
import { config } from "../../config";
import { logAgentResult, logAgentSpawn } from "../shared/log";
import { logMemory } from "../../log";
import { runAgentCommand } from "../shared/subprocess";
import type { WritePolicy } from "../shared/write-policy";
import type { AgentInvoker, AgentJob } from "../flow/types";
import { assertRequireFiles, cmdForLog } from "../flow/run-job";

const RUNNER = "pi";

/** Built-in tools allowed for Engram jobs (no bash／powershell). */
export const PI_ALLOWED_TOOLS = "read,grep,find,ls,edit,write";

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

/** Mechanical write fence for `--append-system-prompt`. */
export function piWriteFence(policy: WritePolicy): string {
  const memories = join(policy.storeDir, "memories");
  const roots = policy.writableRoots.map((r) => `- ${r}`).join("\n");
  return [
    "Engram write policy: you may Write/Edit only under these directories:",
    roots,
    `Never write under ${memories} or store git metadata.`,
    "Deliverables are files on disk; stdout is not the answer. Do not use bash.",
  ].join("\n");
}

/** Build `pi -p` argv from write-policy (exported for unit tests). */
export function buildPiCmd(job: AgentJob, bin = config.piBin): string[] {
  return [
    bin,
    "-p",
    "--no-session",
    "--no-context-files",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-approve",
    "--tools",
    PI_ALLOWED_TOOLS,
    "--append-system-prompt",
    piWriteFence(job.writePolicy),
    "--",
    job.prompt,
  ];
}

/** Spawn Pi non-interactively with tool allowlist (no Bash). */
export class PiInvoker implements AgentInvoker {
  async run(job: AgentJob): Promise<void> {
    const cmd = buildPiCmd(job);

    logSpawn(job, cmd);

    const result = await runAgentCommand({
      cmd,
      cwd: job.cwd,
      processKey: job.processKey,
      onPid: job.onPid,
      exitErrorLabel: job.exitErrorLabel ?? "pi",
    });

    logResult(job, result);
    await assertRequireFiles(job.requireFiles);
  }
}
