import type { AgentRunner, ExtractContext } from "./types";
import type { Patch } from "../dream/schema";
import { taipeiNowIso } from "../store/events";

export class MockFailRunner implements AgentRunner {
  async extract(_ctx: ExtractContext): Promise<Patch[]> {
    throw new Error("mock extract failure");
  }
}

/** Returns a minimal valid patch set for smoke tests without Claude. */
export class MockOkRunner implements AgentRunner {
  async extract(ctx: ExtractContext): Promise<Patch[]> {
    const ts = taipeiNowIso();
    const day = ctx.events[0]?.ts?.slice(0, 10) ?? ts.slice(0, 10);
    const eventIds = ctx.events.map((e) => e.id);
    const node = ctx.existing_nodes[0] ?? "acme";

    const patches: Patch[] = [
      {
        type: "semantic",
        patch_id: `p-mock-sem-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: eventIds.slice(0, 2),
        node,
        facet: "what",
        operation: "append",
        content: `Mock extract note from L1: ${ctx.l1.summary.slice(0, 120)}`,
      },
      {
        type: "chain",
        patch_id: `p-mock-chain-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: eventIds,
        level: "day",
        id: day,
        content: `Day summary (mock): ${ctx.events.map((e) => e.raw).join(" | ").slice(0, 300)}`,
      },
    ];

    if (ctx.l1.summary.toLowerCase().includes("newco") || ctx.events.some((e) => /newco/i.test(e.raw))) {
      patches.push({
        type: "propose_node",
        patch_id: `p-mock-prop-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: eventIds,
        proposed_id: "newco",
        kind: "org",
        aliases: [],
        reason: "mentioned in today's events",
        evidence_event_refs: eventIds,
        seed_facets: { what: "Organization mentioned in ingest" },
      });
    }

    return patches;
  }
}
