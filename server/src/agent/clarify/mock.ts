/** Deterministic mock clarify distill／generate (no network). */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  standingUnderstandingMarkdown,
  understandingRel,
} from "../../store/memories/nodes";
import {
  assertWritablePath,
  dreamWritePolicy,
  guardedWriteFile,
} from "../shared/write-policy";
import type {
  ClarifyDistillAgent,
  ClarifyDistillContext,
  ClarifyDistillResult,
  ClarifyGenerateAgent,
  ClarifyGenerateContext,
  ClarifyGenerateResult,
} from "./types";
import {
  CLARIFY_GENERATE_MAX,
  CLARIFY_GENERATE_MIN,
} from "../../store/memories/clarify";
import { logInfo } from "../../log";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function nodeIdFromRelated(related: string[], fallback: string): string {
  const first = related.find((x) => /^[a-z][a-z0-9_-]*$/i.test(x));
  return first ?? fallback;
}

function appendCurrentSituation(md: string, note: string): string {
  const heading = "## Current situation";
  const idx = md.indexOf(heading);
  if (idx < 0) {
    return `${md.trimEnd()}\n\n${heading}\n\n${note}\n`;
  }
  const after = idx + heading.length;
  const rest = md.slice(after);
  const next = rest.search(/\n##\s+/);
  const before = md.slice(0, after);
  const sectionBody = (next < 0 ? rest : rest.slice(0, next)).trim();
  const afterSection = next < 0 ? "" : rest.slice(next);
  const merged =
    !sectionBody || sectionBody === "_None_"
      ? note
      : `${sectionBody}\n\n${note}`;
  return `${before}\n\n${merged}\n${afterSection}`;
}

/**
 * Mock distill: for each pending item, update／create one draft node main
 * (related_nodes[0] or `clarify-aside`／`clarify-prompt`), appending answer into Current situation.
 * Also attempts a chain write under draft — caller whitelist must strip it.
 */
export class MockClarifyDistillAgent implements ClarifyDistillAgent {
  async distill(ctx: ClarifyDistillContext): Promise<ClarifyDistillResult> {
    if (ctx.pending.length === 0) {
      return { distilled_node_ids: [], narrative: "_None_" };
    }
    if (process.env.ENGRAM_CLARIFY_DISTILL_NOOP === "1") {
      return { distilled_node_ids: [], narrative: "_None_" };
    }
    const policy = dreamWritePolicy({
      store_dir: ctx.store_dir,
      draft_dir: ctx.draft_dir,
      report_path: ctx.report_path,
    });
    const touched = new Set<string>();
    const lines: string[] = [];

    for (const item of ctx.pending) {
      const nodeId = nodeIdFromRelated(
        item.related_nodes,
        item.kind === "aside" ? "clarify-aside" : "clarify-prompt",
      );
      const rel = understandingRel(nodeId);
      const abs = join(ctx.draft_dir, rel);
      let md: string;
      if (await exists(abs)) {
        md = await readFile(abs, "utf8");
      } else {
        // Prefer copy from live if present
        const live = join(ctx.store_dir, rel);
        if (await exists(live)) {
          md = await readFile(live, "utf8");
        } else {
          md = standingUnderstandingMarkdown({
            identity: `Topic distilled from clarify (${nodeId}).`,
            currentSituation: "_None_",
          });
          // Also write meta for create (allowed only if whitelist includes it — main only;
          // meta write will be stripped by whitelist if present).
          const metaRel = `memories/nodes/${nodeId}/node.meta.yaml`;
          const metaAbs = join(ctx.draft_dir, metaRel);
          try {
            assertWritablePath(policy, metaAbs);
            await mkdir(dirname(metaAbs), { recursive: true });
            await writeFile(
              metaAbs,
              `id: ${nodeId}\nkind: topic\naliases: []\n`,
              "utf8",
            );
          } catch {
            // ignore — whitelist may strip meta later; mock still writes main
          }
        }
      }
      const note =
        item.kind === "aside"
          ? `(clarify aside) ${item.answer}`
          : `(clarify Q: ${item.question ?? ""}) A: ${item.answer}`;
      md = appendCurrentSituation(md, note);
      await guardedWriteFile(policy, abs, md);
      touched.add(nodeId);
      lines.push(`- \`${nodeId}\` ← ${item.kind} \`${item.id}\``);

      // Deliberate whitelist violation for tests when ENGRAM_CLARIFY_MOCK_VIOLATE=1
      if (process.env.ENGRAM_CLARIFY_MOCK_VIOLATE === "1") {
        const bad = join(ctx.draft_dir, "memories/chain/days/2099-01/2099-01-01.md");
        try {
          await mkdir(dirname(bad), { recursive: true });
          await writeFile(bad, "# bad\n", "utf8");
          logInfo("clarify mock: wrote whitelist-violating chain file", { path: bad });
        } catch {
          /* ignore */
        }
      }
    }

    return {
      distilled_node_ids: [...touched].sort(),
      narrative: lines.length ? lines.join("\n") : "_None_",
    };
  }
}

/** Mock generate: 3 prompts from candidate nodes (or generic if empty → no-op handled by server). */
export class MockClarifyGenerateAgent implements ClarifyGenerateAgent {
  async generate(ctx: ClarifyGenerateContext): Promise<ClarifyGenerateResult> {
    if (ctx.candidate_node_ids.length === 0 && !ctx.dream_narrative_excerpt.trim()) {
      return { prompts: [] };
    }
    const n = Math.min(
      CLARIFY_GENERATE_MAX,
      Math.max(CLARIFY_GENERATE_MIN, Math.min(5, ctx.candidate_node_ids.length || 3)),
    );
    const prompts = [];
    for (let i = 0; i < n; i++) {
      const node = ctx.candidate_node_ids[i % Math.max(1, ctx.candidate_node_ids.length)];
      const related = node ? [node] : [];
      prompts.push({
        question: node
          ? `What still feels unresolved about ${node}? (mock ${i + 1})`
          : `What should we clarify from this dream? (mock ${i + 1})`,
        related_nodes: related,
      });
    }
    return { prompts };
  }
}
