/** Shared ask-agent subprocess registry helpers. */

import { killAgentProcess } from "../../store/agent-process";

export function askProcessKey(jobId: string): string {
  return `ask:${jobId}`;
}

/** Kill a running ask agent by job id. */
export function killAskAgent(jobId: string, agentPid?: number | null): boolean {
  return killAgentProcess(askProcessKey(jobId), agentPid);
}
