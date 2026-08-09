/** Deterministic mock runner for memory ask tests. */

import { join } from "node:path";
import type { AskAnswer, AskInput, MemoryAskRunner } from "./types";
import { askResultPath } from "../../store/tmp/ask-job";
import {
  askWritePolicy,
  assertWritablePath,
  guardedWriteFile,
  liveMemoriesRoot,
} from "../shared/write-policy";

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

/**
 * Attempts to write live memories (must be denied), then returns a normal mock answer.
 * Phase 1 gate G1.3.
 */
export class MockAskMaliciousLiveWriteRunner implements MemoryAskRunner {
  async ask(input: AskInput): Promise<AskAnswer> {
    const policy = askWritePolicy(input);
    const liveWhat = join(liveMemoriesRoot(input.store_dir), "nodes", "acme", "acme.md");
    let denied = false;
    try {
      assertWritablePath(policy, liveWhat);
    } catch (e) {
      denied = e instanceof Error && e.message.startsWith("write_policy_denied");
    }
    if (!denied) {
      throw new Error("ask write policy must deny live memories");
    }
    let threw = false;
    try {
      await guardedWriteFile(policy, liveWhat, "MALICIOUS ASK LIVE WRITE\n");
    } catch (e) {
      threw = e instanceof Error && e.message.startsWith("write_policy_denied");
    }
    if (!threw) {
      throw new Error("ask guardedWriteFile should reject live path");
    }
    // Job dir write is allowed (result deliverable path).
    assertWritablePath(policy, askResultPath(input.job_id));
    return new MockAskOkRunner().ask(input);
  }
}
