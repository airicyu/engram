/** Deterministic mock runners used by local dream pipeline tests (0.16 file pipeline). */

import { join } from "node:path";
import type { AgentRunner, AmendContext, DreamContext } from "./types";
import { calendarDate, nowIso } from "../../store/memories/activities";
import {
  copyLiveIntoDraft,
  writeDraftFile,
  draftAbs,
} from "../../store/dreams/file-pipeline";
import { dayLedgerRel, daySummaryRel } from "../../store/memories/chain";
import { stringify } from "../../yaml";
import {
  assignZone,
  parseZoneFile,
  renderZoneFile,
  type FutureSightAnchor,
} from "../../store/memories/future-sight";
import { config } from "../../config";
import { readFile, access } from "node:fs/promises";
import { homePath } from "../../store/home";
import {
  assertWritablePath,
  dreamWritePolicy,
  guardedWriteFile,
  liveMemoriesRoot,
  type DreamWriteRoots,
} from "../shared/write-policy";
import {
  hasStandingHeadings,
  nodeWikilink,
  standingUnderstandingMarkdown,
  understandingRel,
} from "../../store/memories/nodes";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Prefer {@link standingUnderstandingMarkdown} from store/memories/nodes. */
export function standingWhatMarkdown(sections: {
  identity: string;
  relation?: string;
  standingFacts?: string;
  currentSituation?: string;
}): string {
  return standingUnderstandingMarkdown(sections);
}

export { hasStandingHeadings, standingUnderstandingMarkdown };

/** Write under draft／report only — enforces 0.20 write policy for mocks. */
async function policyWrite(ctx: DreamWriteRoots, path: string, content: string): Promise<void> {
  const policy = dreamWritePolicy(ctx);
  await guardedWriteFile(policy, path, content);
}

/** Test runner that always fails the dream step. */
export class MockFailRunner implements AgentRunner {
  async dream(_ctx: DreamContext): Promise<void> {
    throw new Error("mock extract failure");
  }

  async amend(_ctx: AmendContext): Promise<void> {
    throw new Error("mock amend failure");
  }
}

/**
 * Attempts to write live `memories/**` (must be denied), then writes a minimal
 * valid report under policy (enough to prove draft／report still writable).
 * Used by Phase 1 sandbox gate G1.1.
 */
export class MockMaliciousLiveWriteRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const policy = dreamWritePolicy(ctx);
    const nodeId = ctx.existing_nodes[0] ?? "acme";
    const liveWhat = join(liveMemoriesRoot(ctx.store_dir), "nodes", nodeId, `${nodeId}.md`);
    let denied = false;
    try {
      assertWritablePath(policy, liveWhat);
    } catch (e) {
      denied = e instanceof Error && e.message.startsWith("write_policy_denied");
    }
    if (!denied) {
      throw new Error("expected live memories write to be denied by write policy");
    }
    let threw = false;
    try {
      await guardedWriteFile(policy, liveWhat, "MALICIOUS LIVE WRITE\n");
    } catch (e) {
      threw = e instanceof Error && e.message.startsWith("write_policy_denied");
    }
    if (!threw) {
      throw new Error("guardedWriteFile should reject live memories path");
    }
    // Prove writable roots still work (without depending on config.storeDir === ctx.store_dir).
    await policyWrite(
      ctx,
      join(ctx.draft_dir, "node-score-involvements.yaml"),
      stringify({ nodes: [] }),
    );
    const scopeIds = ctx.scope.length ? ctx.scope : ctx.events.map((e) => e.id);
    await policyWrite(
      ctx,
      ctx.report_path,
      [
        `# Dream report — ${ctx.dream_run_id}`,
        "",
        "## Scope",
        "",
        ...scopeIds.map((id) => `- \`${id}\``),
        "",
        "## Narrative",
        "### Timeline",
        "",
        "Mock malicious-live probe (live write denied; report ok).",
        "",
      ].join("\n"),
    );
  }

  async amend(ctx: AmendContext): Promise<void> {
    await new MockOkRunner().amend(ctx);
  }
}

/** Writes draft + involvements with an illegal category (must not reach pending_review). */
export class MockBadInvolvementRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const ok = new MockOkRunner();
    await ok.dream(ctx);
    await policyWrite(
      ctx,
      join(ctx.draft_dir, "node-score-involvements.yaml"),
      stringify({
        nodes: [{ id: ctx.existing_nodes[0] ?? "acme", category: "GRADE_9", reason: "bad" }],
      }),
    );
  }

  async amend(ctx: AmendContext): Promise<void> {
    await new MockOkRunner().amend(ctx);
  }
}

/** Report-only draft with no memory file changes → empty_patches on approve. */
export class MockEmptyPatchesRunner implements AgentRunner {
  async dream(ctx: DreamContext): Promise<void> {
    const scopeIds = ctx.scope.length ? ctx.scope : ctx.events.map((e) => e.id);
    await policyWrite(
      ctx,
      join(ctx.draft_dir, "node-score-involvements.yaml"),
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
    await policyWrite(ctx, ctx.report_path, report);
  }

  async amend(ctx: AmendContext): Promise<void> {
    await new MockOkRunner().amend(ctx);
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

    const mockNote = (prefix = "Mock extract note from short-term") =>
      `${prefix}: ${ctx.l1.summary.slice(0, 120)}${
        ctx.review_feedback
          ? ` [retry from ${ctx.review_feedback.retried_from}: ${ctx.review_feedback.reason.slice(0, 80)}]`
          : ""
      }`;

    // Prefer also refreshing a pre-existing primary node (acme if present) when creating.
    const primaryExisting =
      ctx.existing_nodes.find((id) => id === "acme") ?? ctx.existing_nodes[0] ?? null;

    /** P1 sample Relation link to another known／this-round node when available. */
    function sampleRelation(selfId: string, peerHint?: string | null): string {
      const peer =
        peerHint && peerHint !== selfId
          ? peerHint
          : ctx.existing_nodes.find((id) => id !== selfId) ?? null;
      if (!peer) return "_None_";
      return `Related to ${nodeWikilink(peer)}.`;
    }

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
        understandingRel(creatingId),
        standingUnderstandingMarkdown({
          identity: "Organization mentioned in ingest",
          relation: sampleRelation(creatingId, primaryExisting),
          standingFacts: "_None_",
          currentSituation: mockNote(),
        }),
      );
      node = creatingId;
    }

    /** Whole-file rewrite to standing skeleton — never diary-append. */
    async function touchExistingWhat(nodeId: string, peerForLink?: string | null): Promise<void> {
      const whatRel = understandingRel(nodeId);
      await copyLiveIntoDraft(ctx.dream_run_id, whatRel);
      const prior =
        ctx.l2_current.find((n) => n.node === nodeId)?.understanding.trim() ?? "";
      let identity = `Node \`${nodeId}\``;
      let standingFacts = "_None_";
      if (hasStandingHeadings(prior)) {
        const idMatch = prior.match(/## Identity\s*\n([\s\S]*?)(?=\n## Relation\b|$)/);
        const factsMatch = prior.match(
          /## Standing facts\s*\n([\s\S]*?)(?=\n## Current situation\b|$)/,
        );
        const idBody = idMatch?.[1]?.trim();
        const factsBody = factsMatch?.[1]?.trim();
        if (idBody && idBody !== "_None_") identity = idBody;
        if (factsBody && factsBody !== "_None_") standingFacts = factsBody;
      } else if (prior) {
        // Diary-shaped or freeform prior → lift a short carry-forward into Standing facts once.
        standingFacts = prior.slice(0, 200);
      }
      await writeDraftFile(
        ctx.dream_run_id,
        whatRel,
        standingUnderstandingMarkdown({
          identity,
          relation: sampleRelation(nodeId, peerForLink),
          standingFacts,
          currentSituation: mockNote(),
        }),
      );
    }

    if (creatingId) {
      // brandnew path also refreshes primary existing (downscale exclude scenario).
      if (creatingId === "brandnew" && primaryExisting) {
        await touchExistingWhat(primaryExisting, creatingId);
      }
    } else if (ctx.existing_nodes.includes(node)) {
      await touchExistingWhat(node);
    }

    const ledgerRel = dayLedgerRel(chainDay);
    await copyLiveIntoDraft(ctx.dream_run_id, ledgerRel);
    const chainPeer =
      (creatingId && primaryExisting && primaryExisting !== creatingId
        ? primaryExisting
        : null) ??
      ctx.existing_nodes.find((id) => id !== node) ??
      (creatingId && creatingId !== node ? creatingId : null) ??
      (ctx.existing_nodes.includes(node) ? node : null) ??
      node;
    const chainPeerLink = nodeWikilink(chainPeer);
    const ledgerBlock = [
      `<!-- patch:${patchId} -->`,
      `### patch:${patchId} · events:[${eventIds.join(", ")}]`,
      "",
      `Day ledger (mock): noted ${chainPeerLink}; ${ctx.events.map((e) => e.raw).join(" | ").slice(0, 300)}`,
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
      ? `${priorSummary} ${increment} (also ${chainPeerLink})`.trim()
      : `Day summary (mock): work with ${chainPeerLink}; ${increment}`;
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
      await policyWrite(
        ctx,
        join(ctx.draft_dir, "node-score-involvements.yaml"),
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
      creatingId
        ? `Created node \`${node}\` standing understanding (Identity＋Current situation); day summary／ledger for ${chainDay}.`
        : `Rewrote node \`${node}\` standing understanding (Current situation from short-term); day summary／ledger for ${chainDay}.`,
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

    await policyWrite(ctx, ctx.report_path, report);
  }

  /** Minimal same-run amend: update Uncertainties to echo the instruction. */
  async amend(ctx: AmendContext): Promise<void> {
    let raw = "";
    try {
      raw = await readFile(ctx.report_path, "utf8");
    } catch {
      raw = "";
    }
    const note = `Mock amend applied: ${ctx.instruction.slice(0, 200)}`;
    let next: string;
    if (raw.includes("### Uncertainties")) {
      next = raw.replace(
        /### Uncertainties\s*\n[\s\S]*?(?=\n## |\n### |$)/,
        `### Uncertainties\n\n${note}\n\n`,
      );
    } else {
      next = [
        `# Dream report — ${ctx.dream_run_id}`,
        "",
        "## Narrative",
        "### Timeline",
        "",
        "_None_",
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
        note,
        "",
      ].join("\n");
    }
    await policyWrite(ctx, ctx.report_path, next);
  }
}
