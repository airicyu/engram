import type { Patch } from "./schema";
import type { PoolEntry } from "../store/l1";
import { futureChainIds } from "../store/draft";
import { taipeiDate } from "../store/events";

/** Build a human-readable dream report from extract outputs. */
export function buildDreamReport(opts: {
  dream_run_id: string;
  scope: string[];
  events: PoolEntry[];
  patches: Patch[];
}): string {
  const { dream_run_id, scope, events, patches } = opts;
  const today = taipeiDate();
  const lines: string[] = [];

  lines.push(`# Dream report — ${dream_run_id}`);
  lines.push("");
  lines.push(`Generated: ${today} (Asia/Taipei)`);
  lines.push("");

  lines.push("## Scope (L1 event ids to clear on approve)");
  lines.push("");
  if (scope.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const id of scope) {
      lines.push(`- \`${id}\``);
    }
  }
  lines.push("");

  lines.push("## Events covered");
  lines.push("");
  if (events.length === 0) {
    lines.push("_No events in scope._");
  } else {
    for (const e of events) {
      lines.push(`- **${e.id}** [${e.ts}] ${e.raw.trim()}`);
    }
  }
  lines.push("");

  if (patches.length === 0) {
    lines.push("## No L2 writes proposed");
    lines.push("");
    lines.push(
      "> **Approving will clear this round's L1 scope (S) with no long-term writes.** " +
        "Use this when there is nothing worth distilling — confirm discard of short-term only.",
    );
    lines.push("");
  }

  const chains = patches.filter((p): p is Extract<Patch, { type: "chain" }> => p.type === "chain");
  const future = futureChainIds(patches, today);
  const occurrence = chains.filter((p) => !future.includes(p.id));

  lines.push("## Timeline (proposed)");
  lines.push("");
  if (occurrence.length === 0) {
    lines.push("_No memory-chain day patches._");
  } else {
    const byDay = new Map<string, string[]>();
    for (const c of occurrence) {
      const list = byDay.get(c.id) ?? [];
      list.push(c.content.trim());
      byDay.set(c.id, list);
    }
    for (const day of [...byDay.keys()].sort()) {
      const role = day === today ? "occurrence (= encoding today)" : "occurrence";
      lines.push(`### ${day} (${role})`);
      for (const content of byDay.get(day)!) {
        lines.push(`- ${content}`);
      }
      lines.push("");
    }
  }

  lines.push("## Future mentions (not memory-chain; → 0.4.0)");
  lines.push("");
  if (future.length === 0) {
    lines.push("_None detected in chain patches._");
  } else {
    lines.push(
      "> These `chain.id` values are **after today** and will be **blocked at approve** (`409 future_chain_id`). Supersede to fix, or wait until the day is no longer future.",
    );
    lines.push("");
    for (const id of future) {
      const patch = chains.find((c) => c.id === id);
      lines.push(`- **${id}** — ${patch?.content.trim() ?? "(no content)"}`);
    }
  }
  lines.push("");

  const creates = patches.filter(
    (p): p is Extract<Patch, { type: "propose_node" }> => p.type === "propose_node",
  );
  lines.push("## New nodes (create on approve)");
  lines.push("");
  if (creates.length === 0) {
    lines.push("_None._");
  } else {
    for (const p of creates) {
      lines.push(
        `- **${p.proposed_id}** (${p.kind}) — ${p.reason}${p.seed_facets?.what ? `\n  - seed what: ${p.seed_facets.what}` : ""}`,
      );
    }
  }
  lines.push("");

  const semantics = patches.filter(
    (p): p is Extract<Patch, { type: "semantic" }> => p.type === "semantic",
  );
  lines.push("## L2 what updates");
  lines.push("");
  if (semantics.length === 0) {
    lines.push("_None._");
  } else {
    for (const p of semantics) {
      lines.push(`- **${p.node}** \`${p.operation}\`: ${p.content.trim()}`);
    }
  }
  lines.push("");

  const episodics = patches.filter(
    (p): p is Extract<Patch, { type: "episodic" }> => p.type === "episodic",
  );
  if (episodics.length > 0) {
    lines.push("## Episodic / attribution");
    lines.push("");
    for (const p of episodics) {
      const tag = p.confidence < 0.6 ? "→ attribution candidate" : "→ (chronology skip)";
      lines.push(`- **${p.node}** conf=${p.confidence} ${tag}: ${p.content.trim()}`);
    }
    lines.push("");
  }

  lines.push("## Patch list");
  lines.push("");
  if (patches.length === 0) {
    lines.push("_Empty patch array._");
  } else {
    for (const p of patches) {
      lines.push(`- \`${p.patch_id}\` · **${p.type}**`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
