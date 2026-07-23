/** Deterministic mock runner for memory ask tests. */

import type { AskAnswer, AskInput, MemoryAskRunner } from "./memory-ask-types";

/** Returns a fixed ask answer without a live agent. */
export class MockAskOkRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    return {
      answer: `Mock answer for: ${input.q}`,
      sources: [{ kind: "L1", reason: "mock-ask-ok" }],
      confidence: "high",
    };
  }
}
