/** Central ENGRAM_AGENT resolution + AgentInvoker factory (0.20 Phase 7). */

import { MemoryAskRunnerImpl } from "./ask/runner";
import { MockAskMaliciousLiveWriteRunner, MockAskOkRunner } from "./ask/mock";
import type { MemoryAskRunner } from "./ask/types";
import { DreamCliRunner } from "./dream/runner";
import {
  MockBadInvolvementRunner,
  MockEmptyPatchesRunner,
  MockFailRunner,
  MockMaliciousLiveWriteRunner,
  MockOkRunner,
} from "./dream/mock";
import type { AgentRunner } from "./dream/types";
import type { AgentInvoker } from "./flow/types";
import { ClaudeInvoker } from "./providers/claude";
import { CursorInvoker } from "./providers/cursor";
import { CliRollupAgent, MockRollupAgent } from "./rollup/agent";
import type { RollupAgent } from "../dream/rollup/cascade";

export type AgentMode =
  | "claude"
  | "cursor"
  | "mock-ok"
  | "mock-fail"
  | "mock-bad-involvement"
  | "mock-empty-patches"
  | "mock-malicious-live"
  | "mock-ask-ok"
  | "mock-ask-malicious-live";

const AGENT_MODES = new Set<AgentMode>([
  "claude",
  "cursor",
  "mock-ok",
  "mock-fail",
  "mock-bad-involvement",
  "mock-empty-patches",
  "mock-malicious-live",
  "mock-ask-ok",
  "mock-ask-malicious-live",
]);

/** Empty or unset ENGRAM_AGENT uses the default Claude Code runners. */
export function resolveAgentMode(value = process.env.ENGRAM_AGENT): AgentMode {
  const mode = value?.trim() || "claude";
  if (AGENT_MODES.has(mode as AgentMode)) return mode as AgentMode;
  throw new Error(`invalid ENGRAM_AGENT mode: ${mode}`);
}

/** Shared Claude／Cursor invoker for Ask／Dream／Rollup file-deliverable jobs. */
export function createAgentInvoker(): AgentInvoker {
  switch (resolveAgentMode()) {
    case "cursor":
      return new CursorInvoker();
    case "claude":
      return new ClaudeInvoker();
    default:
      // Mock modes should not spawn; callers use domain mocks via facades.
      throw new Error(
        `createAgentInvoker: mode ${resolveAgentMode()} does not spawn a live agent`,
      );
  }
}

export function createDreamRunner(): AgentRunner {
  switch (resolveAgentMode()) {
    case "mock-fail":
      return new MockFailRunner();
    case "mock-ok":
      return new MockOkRunner();
    case "mock-malicious-live":
      return new MockMaliciousLiveWriteRunner();
    case "mock-bad-involvement":
      return new MockBadInvolvementRunner();
    case "mock-empty-patches":
      return new MockEmptyPatchesRunner();
    case "cursor":
    case "claude":
      return new DreamCliRunner(createAgentInvoker());
    default:
      return new DreamCliRunner(new ClaudeInvoker());
  }
}

export function createAskRunner(): MemoryAskRunner {
  switch (resolveAgentMode()) {
    case "mock-ask-ok":
      return new MockAskOkRunner();
    case "mock-ask-malicious-live":
      return new MockAskMaliciousLiveWriteRunner();
    case "cursor":
    case "claude":
      return new MemoryAskRunnerImpl(createAgentInvoker());
    default:
      return new MemoryAskRunnerImpl(new ClaudeInvoker());
  }
}

export function createRollupAgent(): RollupAgent {
  switch (resolveAgentMode()) {
    case "cursor":
    case "claude":
      return new CliRollupAgent(createAgentInvoker());
    default:
      return new MockRollupAgent();
  }
}
