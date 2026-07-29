/** Deterministic mock runners used by local dream pipeline tests (0.16 file pipeline). */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentRunner, DreamContext } from "./types";
import { calendarDate, nowIso } from "../store/memories/activities";
import {
  copyLiveIntoDraft,
  writeDraftFile,
} from "../store/dreams/file-pipeline";
import { dayLedgerRel, daySummaryRel } from "../store/memories/chain";
import { stringify } from "../yaml";
import { renderFutureSightMarkdown } from "../store/memories/future-sight";

async function ensureWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

/** Test runner that always fails the dream step. */
export class MockFailRunner implements AgentRunner {
  async dream(_ctx: DreamContext): Promise<void> {
    throw new Error("mock extract failure");
  }
}

/** Writes a minimal valid draft + narrative report without a live agent. */
export class MockOkRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const ts = nowIso();
    const today = calendarDate();
    const eventIds = ctx.events.map((e) => e.id);
    const scopeIds = ctx.scope.length ? ctx.scope : eventIds;
    const firstDay = ctx.events[0] ? calendarDate(ctx.events[0].ts) : today;
    const chainDay = firstDay > today ? today : firstDay;
    const patchId = `p-mock-chain-${Date.now()}`;

    const wantsNewco =
      ctx.l1.summary.toLowerCase().includes("newco") ||
      ctx.events.some((e) => /newco/i.test(e.raw));

    let node =
      wantsNewco && !ctx.existing_nodes.includes("newco")
        ? "newco"
        : (ctx.existing_nodes[0] ?? "acme");

    if (wantsNewco && !ctx.existing_nodes.includes("newco")) {
      const metaRel = `memories/nodes/newco/node.meta.yaml`;
      await writeDraftFile(
        ctx.dream_run_id,
        metaRel,
        stringify({
          id: "newco",
          kind: "org",
          aliases: [],
          created_at: ts,
        }),
      );
      await writeDraftFile(
        ctx.dream_run_id,
        "memories/nodes/newco/understand/what.md",
        "Organization mentioned in ingest\n",
      );
      await writeDraftFile(
        ctx.dream_run_id,
        "memories/nodes/newco/INDEX.md",
        "# newco\n\nSee understand/what.md\n",
      );
      node = "newco";
    }

    if (ctx.existing_nodes.includes(node) || node === "newco") {
      const whatRel = `memories/nodes/${node}/understand/what.md`;
      await copyLiveIntoDraft(ctx.dream_run_id, whatRel);
      let prior = "";
      try {
        prior =
          ctx.l2_current.find((n) => n.node === node)?.what_current.trim() ?? "";
      } catch {
        prior = "";
      }
      if (!prior) {
        // draft may have seed what
        prior = "";
      }
      const note = `Mock extract note from short-term: ${ctx.l1.summary.slice(0, 120)}${
        ctx.review_feedback
          ? ` [retry from ${ctx.review_feedback.retried_from}: ${ctx.review_feedback.reason.slice(0, 80)}]`
          : ""
      }`;
      const body = prior ? `${prior}\n\n${note}` : note;
      // If we seeded newco what already, append mock note
      if (node === "newco" && wantsNewco && !ctx.existing_nodes.includes("newco")) {
        await writeDraftFile(
          ctx.dream_run_id,
          whatRel,
          `Organization mentioned in ingest\n\n${note}\n`,
        );
      } else {
        await writeDraftFile(ctx.dream_run_id, whatRel, `${body}\n`);
      }
    }

    const ledgerRel = dayLedgerRel(chainDay);
    await copyLiveIntoDraft(ctx.dream_run_id, ledgerRel);
    const ledgerBlock = [
      `<!-- patch:${patchId} -->`,
      `### patch:${patchId} · events:[${eventIds.join(", ")}]`,
      "",
      `Day ledger (mock): ${ctx.events.map((e) => e.raw).join(" | ").slice(0, 300)}`,
      "",
    ].join("\n");
    let ledgerBase = "";
    const priorLedger = (ctx.chain_ledgers ?? []).find((d) => d.day === chainDay)?.content ?? "";
    if (priorLedger.trim()) ledgerBase = priorLedger;
    const ledgerNext = ledgerBase.trim()
      ? `${ledgerBase.trimEnd()}\n${ledgerBlock}`
      : ledgerBlock;
    await writeDraftFile(ctx.dream_run_id, ledgerRel, ledgerNext);

    const priorSummary =
      (ctx.chain_summaries_current ?? []).find((d) => d.day === chainDay)?.current.trim() ?? "";
    const increment = ctx.events.map((e) => e.raw.trim()).join(" ").slice(0, 200);
    const summary = priorSummary
      ? `${priorSummary} ${increment}`.trim()
      : `Day summary (mock): ${increment}`;
    await writeDraftFile(ctx.dream_run_id, daySummaryRel(chainDay), `${summary}\n`);

    const wantsFuture =
      /\bdeadline\b/i.test(ctx.l1.summary) ||
      ctx.events.some((e) => /\bdeadline\b/i.test(e.raw) || /fs-mock/i.test(e.raw));

    let futureLine = "_None_";
    if (wantsFuture) {
      const d = new Date(`${today}T12:00:00+08:00`);
      d.setDate(d.getDate() + 14);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const anchor = `${y}-${m}-${day}`;
      const id = `fs-${anchor}-deadline`;
      const md = renderFutureSightMarkdown({
        id,
        anchor_start: anchor,
        anchor_end: anchor,
        content: "Mock near-horizon deadline from short-term",
        node_refs:
          node !== "acme" || ctx.existing_nodes.includes("acme") ? [node] : undefined,
        event_refs: eventIds,
        dream_run_id: ctx.dream_run_id,
      });
      await writeDraftFile(
        ctx.dream_run_id,
        `memories/future-sight/active/${id}.md`,
        md,
      );
      futureLine = `Proposed future-sight \`${id}\` (${anchor}): Mock near-horizon deadline from short-term`;
    }

    const retryBlock = ctx.review_feedback
      ? [
          "## Retry feedback",
          "",
          `- **retried_from:** \`${ctx.review_feedback.retried_from}\``,
          `- **reason:** ${ctx.review_feedback.reason.trim()}`,
          "",
        ].join("\n")
      : "";

    const report = [
      `# Dream report — ${ctx.dream_run_id}`,
      "",
      retryBlock,
      "## Scope",
      "",
      ...(scopeIds.map((id) => `- \`${id}\``)),
      "",
      "## Events covered",
      "",
      ...ctx.events.map((e) => `- **${e.id}** [${e.ts}] ${e.raw.trim()}`),
      "",
      "## Narrative",
      "### Timeline",
      "",
      `Mock consolidated day ${chainDay} from ${ctx.events.length} event(s).`,
      "",
      "### Long-term updates",
      "",
      `Updated node \`${node}\` and day summary／ledger for ${chainDay}.`,
      "",
      "### Near future",
      "",
      futureLine,
      "",
      "### Uncertainties",
      "",
      "_None_",
      "",
      "## Appendix — pending deploy",
      "### Paths",
      "",
      "_Server will rewrite this appendix._",
      "",
    ].join("\n");

    await ensureWrite(ctx.report_path, report);
  }
}
