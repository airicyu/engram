/** Human-readable review report renderer for pending dream runs. */

import type { Patch } from "./schema";
import type { PoolEntry } from "../store/l1";
import { futureChainIds } from "../store/draft";
import { calendarDate } from "../store/events";
import { config } from "../config";

/** Build a human-readable dream report from extract outputs. */
export function buildDreamReport(opts: {
  dream_run_id: string;
  scope: string[];
  events: PoolEntry[];
  patches: Patch[];
}): string {
  const { dream_run_id, scope, events, patches } = opts;
  const today = calendarDate();
  const lines: string[] = [];

  lines.push(`# Dream report — ${dream_run_id}`);
  lines.push("");
  lines.push(`Generated: ${today} (${config.timezone})`);
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
  const misfiled = futureChainIds(patches, today);
  const occurrence = chains.filter((p) => !misfiled.includes(p.id));

  lines.push("## Timeline (proposed)");
  lines.push("");
  if (occurrence.length === 0) {
    lines.push("_No memory-chain day patches._");
  } else {
    const byDay = new Map<string, Extract<Patch, { type: "chain" }>[]>();
    for (const c of occurrence) {
      const list = byDay.get(c.id) ?? [];
      list.push(c);
      byDay.set(c.id, list);
    }
    for (const day of [...byDay.keys()].sort()) {
      const role = day === today ? "occurrence (= encoding today)" : "occurrence";
      lines.push(`### ${day} (${role})`);
      for (const c of byDay.get(day)!) {
        if (c.summary?.trim()) {
          lines.push(`- **summary** (${c.summary_operation ?? "?"}): ${c.summary.trim()}`);
          lines.push("");
          lines.push("<details><summary>ledger increment</summary>");
          lines.push("");
          lines.push(c.content.trim());
          lines.push("");
          lines.push("</details>");
        } else {
          lines.push(`- ${c.content.trim()}`);
        }
      }
      lines.push("");
    }
  }

  const futures = patches.filter(
    (p): p is Extract<Patch, { type: "future" }> => p.type === "future",
  );
  lines.push("## Proposed future-sight");
  lines.push("");
  if (futures.length === 0) {
    lines.push("_None._");
  } else {
    lines.push(
      "> Near-horizon anchors — will write `future-sight/active/` on approve. " +
        "`anchor_end` must be ≥ today or approve returns `409 stale_future_anchor`.",
    );
    lines.push("");
    for (const f of futures) {
      const range =
        f.anchor_start === f.anchor_end
          ? f.anchor_start
          : `${f.anchor_start} → ${f.anchor_end}`;
      const nodes = f.node_refs?.length ? ` · nodes:[${f.node_refs.join(", ")}]` : "";
      lines.push(`- **\`${f.id}\`** (${range})${nodes} — ${f.content.trim()}`);
    }
  }
  lines.push("");

  if (misfiled.length > 0) {
    lines.push("## Misfiled future chain.id (blocked at approve)");
    lines.push("");
    lines.push(
      "> These `chain.id` values are **after today** and will be **blocked** (`409 future_chain_id`). " +
        "Supersede and emit `type: future` instead.",
    );
    lines.push("");
    for (const id of misfiled) {
      const patch = chains.find((c) => c.id === id);
      lines.push(`- **${id}** — ${patch?.content.trim() ?? "(no content)"}`);
    }
    lines.push("");
  }

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
