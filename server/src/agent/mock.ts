/** Deterministic mock runners used by local dream pipeline tests (0.16 file pipeline). */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentRunner, DreamContext } from "./types";
import { calendarDate, nowIso } from "../store/memories/activities";
import {
  copyLiveIntoDraft,
  writeDraftFile,
  draftAbs,
} from "../store/dreams/file-pipeline";
import { draftDir } from "../store/dreams/dream-runs";
import { dayLedgerRel, daySummaryRel } from "../store/memories/chain";
import { stringify } from "../yaml";
import {
  assignZone,
  parseZoneFile,
  renderZoneFile,
  type FutureSightAnchor,
} from "../store/memories/future-sight";
import { config } from "../config";
import { readFile, access } from "node:fs/promises";
import { homePath } from "../store/home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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

/** Writes draft + involvements with an illegal category (must not reach pending_review). */
export class MockBadInvolvementRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const ok = new MockOkRunner();
    await ok.dream(ctx);
    await ensureWrite(
      join(draftDir(ctx.dream_run_id), "node-score-involvements.yaml"),
      stringify({
        nodes: [{ id: ctx.existing_nodes[0] ?? "acme", category: "GRADE_9", reason: "bad" }],
      }),
    );
  }
}

/** Report-only draft with no memory file changes → empty_patches on approve. */
export class MockEmptyPatchesRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const scopeIds = ctx.scope.length ? ctx.scope : ctx.events.map((e) => e.id);
    await ensureWrite(
      join(draftDir(ctx.dream_run_id), "node-score-involvements.yaml"),
      stringify({
        nodes: ctx.existing_nodes[0]
          ? [{ id: ctx.existing_nodes[0], category: "focus", reason: "should not settle" }]
          : [],
      }),
    );
    const report = [
      `# Dream report — ${ctx.dream_run_id}`,
      "",
      "## Scope",
      "",
      ...scopeIds.map((id) => `- \`${id}\``),
      "",
      "## Events covered",
      "",
      ...ctx.events.map((e) => `- **${e.id}** [${e.ts}] ${e.raw.trim()}`),
      "",
      "## Narrative",
      "### Timeline",
      "",
      "Mock empty-patches dream (no file changes).",
      "",
      "### Long-term updates",
      "",
      "_None_",
      "",
      "### Near future",
      "",
      "_None_",
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
    const wantsBrandnew =
      ctx.l1.summary.toLowerCase().includes("brandnew") ||
      ctx.events.some((e) => /brandnew/i.test(e.raw));

    let node =
      wantsNewco && !ctx.existing_nodes.includes("newco")
        ? "newco"
        : wantsBrandnew && !ctx.existing_nodes.includes("brandnew")
          ? "brandnew"
          : (ctx.existing_nodes[0] ?? "acme");

    const creatingId =
      (wantsNewco && !ctx.existing_nodes.includes("newco") && "newco") ||
      (wantsBrandnew && !ctx.existing_nodes.includes("brandnew") && "brandnew") ||
      null;

    if (creatingId) {
      const metaRel = `memories/nodes/${creatingId}/node.meta.yaml`;
      await writeDraftFile(
        ctx.dream_run_id,
        metaRel,
        stringify({
          id: creatingId,
          kind: "org",
          aliases: [],
          created_at: ts,
        }),
      );
      await writeDraftFile(
        ctx.dream_run_id,
        `memories/nodes/${creatingId}/understand/what.md`,
        "Organization mentioned in ingest\n",
      );
      await writeDraftFile(
        ctx.dream_run_id,
        `memories/nodes/${creatingId}/INDEX.md`,
        `# ${creatingId}\n\nSee understand/what.md\n`,
      );
      node = creatingId;
    }

    // Prefer also refreshing a pre-existing primary node (acme if present) when creating.
    const primaryExisting =
      ctx.existing_nodes.find((id) => id === "acme") ?? ctx.existing_nodes[0] ?? null;

    async function touchExistingWhat(nodeId: string): Promise<void> {
      const whatRel = `memories/nodes/${nodeId}/understand/what.md`;
      await copyLiveIntoDraft(ctx.dream_run_id, whatRel);
      const prior =
        ctx.l2_current.find((n) => n.node === nodeId)?.what_current.trim() ?? "";
      const note = `Mock extract note from short-term: ${ctx.l1.summary.slice(0, 120)}${
        ctx.review_feedback
          ? ` [retry from ${ctx.review_feedback.retried_from}: ${ctx.review_feedback.reason.slice(0, 80)}]`
          : ""
      }`;
      const body = prior ? `${prior}\n\n${note}` : note;
      await writeDraftFile(ctx.dream_run_id, whatRel, `${body}\n`);
    }

    if (creatingId) {
      await writeDraftFile(
        ctx.dream_run_id,
        `memories/nodes/${creatingId}/understand/what.md`,
        `Organization mentioned in ingest\n\nMock extract note from short-term: ${ctx.l1.summary.slice(0, 120)}\n`,
      );
      // brandnew path also refreshes primary existing (downscale exclude scenario).
      if (creatingId === "brandnew" && primaryExisting) {
        await touchExistingWhat(primaryExisting);
      }
    } else if (ctx.existing_nodes.includes(node)) {
      await touchExistingWhat(node);
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
      const anchorDay = `${y}-${m}-${day}`;
      const id = `fs-${anchorDay}-deadline`;
      const anchor: FutureSightAnchor = {
        id,
        anchor_start: anchorDay,
        anchor_end: anchorDay,
        content: "Mock near-horizon deadline from short-term",
      };
      const zone = assignZone(
        anchor,
        today,
        config.futureSightHotDays,
        config.futureSightWindowDays,
      );
      if (zone === "hot" || zone === "later") {
        for (const z of ["hot", "later"] as const) {
          await copyLiveIntoDraft(ctx.dream_run_id, `memories/future-sight/${z}.md`);
        }
        const load = async (z: "hot" | "later"): Promise<FutureSightAnchor[]> => {
          const p = draftAbs(ctx.dream_run_id, "memories", "future-sight", `${z}.md`);
          if (!(await exists(p))) {
            const live = homePath("memories", "future-sight", `${z}.md`);
            if (await exists(live)) {
              try {
                return parseZoneFile(await readFile(live, "utf8"), z);
              } catch {
                return [];
              }
            }
            return [];
          }
          try {
            return parseZoneFile(await readFile(p, "utf8"), z);
          } catch {
            return [];
          }
        };
        let hot = (await load("hot")).filter((a) => a.id !== id);
        let later = (await load("later")).filter((a) => a.id !== id);
        if (zone === "hot") hot.push(anchor);
        else later.push(anchor);
        await writeDraftFile(
          ctx.dream_run_id,
          "memories/future-sight/hot.md",
          renderZoneFile("hot", hot),
        );
        await writeDraftFile(
          ctx.dream_run_id,
          "memories/future-sight/later.md",
          renderZoneFile("later", later),
        );
        futureLine = `Proposed future-sight \`${id}\` (${anchorDay}, zone=${zone}): Mock near-horizon deadline from short-term`;
      }
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

    // 0.19: involvements artifact — only pre-existing nodes (creates omitted).
    const involvementNodes: Array<{ id: string; category: string; reason?: string }> = [];
    const involvedExisting =
      creatingId === "brandnew" && primaryExisting
        ? primaryExisting
        : !creatingId && ctx.existing_nodes.includes(node)
          ? node
          : null;
    if (involvedExisting) {
      involvementNodes.push({
        id: involvedExisting,
        category: "focus",
        reason: "Mock primary node update",
      });
    }
    {
      await ensureWrite(
        join(draftDir(ctx.dream_run_id), "node-score-involvements.yaml"),
        stringify({ nodes: involvementNodes }),
      );
    }

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
