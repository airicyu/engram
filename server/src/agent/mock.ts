/** Deterministic mock runners used by local dream pipeline tests. */

import type { AgentRunner, ExtractContext } from "./types";
import type { Patch } from "../dream/schema";
import { calendarDate, nowIso } from "../store/events";

/** Test runner that always fails extraction. */
export class MockFailRunner implements AgentRunner {
  async extract(_ctx: ExtractContext): Promise<Patch[]> {
    throw new Error("mock extract failure");
  }
}

/** Returns a minimal valid patch set for smoke tests without a live agent. */
export class MockOkRunner implements AgentRunner {
  async extract(ctx: ExtractContext): Promise<Patch[]> {
    const ts = nowIso();
    const today = calendarDate();
    const eventIds = ctx.events.map((e) => e.id);
    const scopeIds = ctx.scope.length ? ctx.scope : eventIds;

    // Prefer occurrence day from first event ts, but never future vs today
    const firstDay = ctx.events[0] ? calendarDate(ctx.events[0].ts) : today;
    const chainDay = firstDay > today ? today : firstDay;

    const patches: Patch[] = [];

    const wantsNewco =
      ctx.l1.summary.toLowerCase().includes("newco") ||
      ctx.events.some((e) => /newco/i.test(e.raw));

    if (wantsNewco && !ctx.existing_nodes.includes("newco")) {
      patches.push({
        type: "propose_node",
        patch_id: `p-mock-prop-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: eventIds,
        proposed_id: "newco",
        kind: "org",
        aliases: [],
        reason: "mentioned in scoped events",
        evidence_event_refs: eventIds,
        seed_facets: { what: "Organization mentioned in ingest" },
      });
    }

    const node =
      wantsNewco && !ctx.existing_nodes.includes("newco")
        ? "newco"
        : (ctx.existing_nodes[0] ?? "acme");

    if (ctx.existing_nodes.includes(node) || (wantsNewco && node === "newco")) {
      patches.push({
        type: "semantic",
        patch_id: `p-mock-sem-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: scopeIds.slice(0, 2),
        node,
        facet: "what",
        operation: "append",
        content: `Mock extract note from L1: ${ctx.l1.summary.slice(0, 120)}`,
      });
    }

    patches.push({
      type: "chain",
      patch_id: `p-mock-chain-${Date.now()}`,
      dream_run_id: ctx.dream_run_id,
      ts,
      event_refs: eventIds,
      level: "day",
      id: chainDay,
      content: `Day ledger (mock): ${ctx.events.map((e) => e.raw).join(" | ").slice(0, 300)}`,
      summary: (() => {
        const prior =
          (ctx.chain_summaries_current ?? []).find((d) => d.day === chainDay)?.current.trim() ?? "";
        const increment = ctx.events.map((e) => e.raw.trim()).join(" ").slice(0, 200);
        return prior
          ? `${prior} ${increment}`.trim()
          : `Day summary (mock): ${increment}`;
      })(),
      summary_operation: (() => {
        const prior =
          (ctx.chain_summaries_current ?? []).find((d) => d.day === chainDay)?.current.trim() ?? "";
        return prior ? "revise" : "init";
      })(),
    });

    const wantsFuture =
      /\bdeadline\b/i.test(ctx.l1.summary) ||
      ctx.events.some((e) => /\bdeadline\b/i.test(e.raw) || /fs-mock/i.test(e.raw));

    if (wantsFuture) {
      // ~14 days ahead so approve is not stale
      const d = new Date(`${today}T12:00:00+08:00`);
      d.setDate(d.getDate() + 14);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const anchor = `${y}-${m}-${day}`;
      patches.push({
        type: "future",
        patch_id: `p-mock-future-${Date.now()}`,
        dream_run_id: ctx.dream_run_id,
        ts,
        event_refs: eventIds,
        id: `fs-${anchor}-deadline`,
        anchor_start: anchor,
        anchor_end: anchor,
        content: "Mock near-horizon deadline from L1",
        node_refs: node !== "acme" || ctx.existing_nodes.includes("acme") ? [node] : undefined,
      });
    }

    return patches;
  }
}
