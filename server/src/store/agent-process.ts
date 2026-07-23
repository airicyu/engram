/** In-memory registry of spawned agent subprocesses for manual cancel. */

type Tracked = {
  key: string;
  proc: { kill: () => void; pid?: number };
  pid: number;
  startedAt: string;
};

const registry = new Map<string, Tracked>();

/** Register a spawned agent process under a stable key (e.g. dream:ID, ask:ID). */
export function registerAgentProcess(
  key: string,
  proc: { kill: () => void; pid?: number },
  startedAt = new Date().toISOString(),
): number | null {
  const pid = proc.pid ?? null;
  if (pid == null) return null;
  registry.set(key, { key, proc, pid, startedAt });
  return pid;
}

/** Remove a process from the registry without killing. */
export function unregisterAgentProcess(key: string): void {
  registry.delete(key);
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Kill a tracked or orphan agent by registry key and optional persisted PID. */
export function killAgentProcess(key: string, agentPid?: number | null): boolean {
  const tracked = registry.get(key);
  if (tracked) {
    try {
      tracked.proc.kill();
    } catch {
      // already dead
    }
    registry.delete(key);
    return true;
  }
  if (agentPid != null && pidAlive(agentPid)) {
    try {
      process.kill(agentPid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Kill all tracked children (graceful server shutdown). */
export function killAllTrackedAgentProcesses(): void {
  for (const t of registry.values()) {
    try {
      t.proc.kill();
    } catch {
      // ignore
    }
  }
  registry.clear();
}
