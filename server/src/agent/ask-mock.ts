/** Deterministic mock runner for memory ask tests. */

import type { AskAnswer, AskInput, MemoryAskRunner } from "./ask-types";

/** Returns a fixed ask answer without a live agent. */
export class MockAskOkRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const laterNote = input.include_later
      ? "include_later=true (later.md allowed)"
      : "include_later=false (later.md forbidden)";
    return {
      answer: `Mock answer for: ${input.q} [${laterNote}]`,
      sources: [
        { kind: "L1", reason: "mock-ask-ok" },
        ...(input.include_later
          ? [{ kind: "future_sight", id: "mock-later", zone: "later", reason: "mock later allowed" }]
          : [{ kind: "future_sight", id: "mock-hot", zone: "hot", reason: "mock hot only" }]),
      ],
      confidence: "high",
    };
  }
}
