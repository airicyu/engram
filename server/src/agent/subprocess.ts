/** Shared agent subprocess lifecycle: env sanitize, spawn, collect, optional registry. */

import {
  registerAgentProcess,
  unregisterAgentProcess,
} from "../store/agent-process";

export type AgentCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  pid?: number;
};

export type RunAgentCommandOpts = {
  cmd: string[];
  cwd: string;
  /** Override env; default = process.env without ENGRAM_STORE_DIR. */
  env?: Record<string, string | undefined>;
  /** When set, register/unregister in the cancel registry under this key. */
  processKey?: string;
  /** Called after spawn when pid is known (e.g. persist to job yaml). */
  onPid?: (pid: number) => void | Promise<void>;
  /** Prefix for non-zero exit Error message (default: "agent"). */
  exitErrorLabel?: string;
};

/** Strip ENGRAM_STORE_DIR so nested agents do not inherit the parent store path. */
export function agentEnvWithoutStoreDir(
  base: NodeJS.ProcessEnv = process.env,
): Record<string, string | undefined> {
  const { ENGRAM_STORE_DIR: _omit, ...rest } = base;
  return rest;
}

/**
 * Spawn an agent CLI, optionally track it for cancel, collect stdout/stderr.
 * Throws on non-zero exit with truncated stderr/stdout preview.
 */
export async function runAgentCommand(
  opts: RunAgentCommandOpts,
): Promise<AgentCommandResult> {
  const env = opts.env ?? agentEnvWithoutStoreDir();
  const started = performance.now();
  const proc = Bun.spawn(opts.cmd, {
    cwd: opts.cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  let pid: number | undefined;
  if (opts.processKey) {
    const registered = registerAgentProcess(opts.processKey, proc);
    if (registered != null) {
      pid = registered;
      if (opts.onPid) await opts.onPid(registered);
    }
  } else if (proc.pid != null) {
    pid = proc.pid;
  }

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const durationMs = Math.round(performance.now() - started);
    if (exitCode !== 0) {
      const label = opts.exitErrorLabel ?? "agent";
      throw new Error(
        `${label} exit ${exitCode}: ${stderr.slice(0, 2000) || stdout.slice(0, 500)}`,
      );
    }

    return { stdout, stderr, exitCode, durationMs, pid };
  } finally {
    if (opts.processKey) unregisterAgentProcess(opts.processKey);
  }
}
