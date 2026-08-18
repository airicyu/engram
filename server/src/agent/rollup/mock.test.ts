/**
 * Rollup mock narrative shape (0.38).
 * Run: `cd server && bun test src/agent/rollup/mock.test.ts`
 */

import { describe, expect, test } from "bun:test";
import type { RollupWriteContext } from "../../dream/rollup/cascade";
import { summaryHasProcessNarration } from "../../dream/report/structure-notes";
import { fuseMockNarrative } from "./mock";

function ctx(
  partial: Pick<RollupWriteContext, "level" | "lower"> &
    Partial<Pick<RollupWriteContext, "prior_current" | "id">>,
): RollupWriteContext {
  return {
    dream_run_id: "dream-mock-038",
    id: partial.id ?? "2026-W25-0615",
    operation: "init",
    timezone: "Asia/Hong_Kong",
    memory_language: "en",
    now: "2026-07-01T12:00:00+08:00",
    today: "2026-07-01",
    prior_current: partial.prior_current ?? "",
    output_path: "/tmp/mock-out.summary.md",
    output_rel: "memories/chain/weeks/2026-06/2026-W25-0615.summary.md",
    ...partial,
  };
}

function headingCount(md: string): number {
  return [...md.matchAll(/^##\s+\S+/gm)].length;
}

function someSectionHasTwoParas(md: string): boolean {
  const chunks = md.split(/\n(?=##\s+)/);
  for (const chunk of chunks) {
    const body = chunk.replace(/^##[^\n]+\n*/, "").trim();
    const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (paras.length >= 2) return true;
  }
  return false;
}

describe("fuseMockNarrative", () => {
  test("starts with ##, has P1, no process narration", () => {
    const out = fuseMockNarrative(
      ctx({
        level: "week",
        lower: [{ id: "2026-06-16", current: "Quiet cafe afternoon with no links." }],
      }),
    );
    expect(/^##\s+\S+/.test(out.trimStart())).toBe(true);
    expect(out.includes("[[nodes/")).toBe(true);
    expect(summaryHasProcessNarration(out)).toBe(false);
  });

  test("does not paste a full lower current", () => {
    const blob = [
      "## Harbor",
      "",
      "Full day paste bait: Harbor UAT with David, then gym minutes, then pork rice at 門牌 12, then Engram 0.29.0 then 0.30.0 then 0.31.0.",
      "",
    ].join("\n");
    const out = fuseMockNarrative(
      ctx({
        level: "week",
        lower: [{ id: "2026-06-16", current: blob }],
      }),
    );
    expect(out.includes(blob.trim())).toBe(false);
  });

  test("week with ≥2 lowers: ≥2 ## and a multi-para section", () => {
    const a = [
      "## Engram",
      "",
      "Shipped clarify and asked [[nodes/engram/engram|engram]] to remember the bot.",
      "",
    ].join("\n");
    const b = [
      "## Harbor",
      "",
      "Harbor standup with David ran long; shipment slip still open.",
      "",
    ].join("\n");
    const out = fuseMockNarrative(
      ctx({
        level: "week",
        lower: [
          { id: "2026-06-16", current: a },
          { id: "2026-06-17", current: b },
        ],
      }),
    );
    expect(headingCount(out)).toBeGreaterThanOrEqual(2);
    expect(someSectionHasTwoParas(out)).toBe(true);
    expect(out.includes(a.trim())).toBe(false);
    expect(out.includes(b.trim())).toBe(false);
    expect(out.includes("[[nodes/engram/engram|engram]]")).toBe(true);
    expect(summaryHasProcessNarration(out)).toBe(false);
  });

  test("month with ≥2 lowers: same shape", () => {
    const w1 = "Week one: cafe brunch and Auntie Lam chat about the weather in Sai Kung.";
    const w2 = "Week two: Harbor UAT blocked; Engram extract retry landed.";
    const out = fuseMockNarrative(
      ctx({
        level: "month",
        id: "2026-06",
        lower: [
          { id: "2026-W23-0601", current: w1 },
          { id: "2026-W24-0608", current: w2 },
        ],
      }),
    );
    expect(headingCount(out)).toBeGreaterThanOrEqual(2);
    expect(someSectionHasTwoParas(out)).toBe(true);
    expect(out.includes(w1)).toBe(false);
    expect(out.includes(w2)).toBe(false);
  });
});
