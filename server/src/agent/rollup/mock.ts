/** Deterministic mock rollup planner／writer. */

import type {
  RollupAgent,
  RollupPlan,
  RollupPlanContext,
  RollupWriteContext,
} from "../../dream/rollup/cascade";

/** Deterministic mock: skip still-open current periods; otherwise Y + fused prose. */
export class MockRollupAgent implements RollupAgent {
  async plan(ctx: RollupPlanContext): Promise<RollupPlan> {
    if (ctx.candidates.length === 0) {
      return { level: ctx.level, execute: false, targets: [], reason: "no candidates" };
    }
    const targets = [];
    for (const m of ctx.candidate_meta) {
      if (m.is_current_period) continue;
      targets.push({
        id: m.id,
        operation: m.suggested_operation,
        reason: m.exists ? "past period revise (mock)" : "past period init (mock)",
      });
    }
    if (targets.length === 0) {
      return {
        level: ctx.level,
        execute: false,
        targets: [],
        reason: "only current open period (mock)",
      };
    }
    return { level: ctx.level, execute: true, targets };
  }

  async write(ctx: RollupWriteContext): Promise<string> {
    return fuseMockNarrative(ctx);
  }
}

/** Build sectioned markdown from lower currents (## short titles; no … truncation). */
export function fuseMockNarrative(ctx: RollupWriteContext): string {
  const unique = collectGrains(ctx.lower);

  let body: string;
  if (unique.length === 0) {
    const note = ctx.prior_current.trim()
      ? `Earlier themes still held; lower layers added little new.`
      : `Little was recorded in lower memory layers.`;
    body = `## Note\n\n${note}`;
  } else {
    body = fuseByLifeDimensions(
      unique,
      ctx.level === "year" ? "year" : ctx.level === "month" ? "month" : "week",
    );
  }

  // 0.31: higher summaries must carry at least one P1 when lower already had links
  // (or fall back to a stable mock peer so phases can lock the contract).
  if (!body.includes("[[nodes/")) {
    const blob = [...ctx.lower.map((x) => x.current), ctx.prior_current].join("\n");
    const m = /\[\[nodes\/([^/\]]+)\/\1(?:\|[^\]]*)?\]\]/.exec(blob);
    const link = m ? m[0]! : "[[nodes/acme/acme|acme]]";
    body = `${body}\n\nAlso ${link}.`;
  }
  return body;
}

/** Prefer ## sections or full paragraphs from lower summaries; fall back to first sentences. */
function collectGrains(
  lower: Array<{ id: string; current: string; missing?: boolean }>,
): string[] {
  const unique: string[] = [];
  const push = (g: string) => {
    const t = stripHeadingLine(stripPeriodPrefix(g.trim()));
    if (!t) return;
    if (unique.some((u) => u === t || u.includes(t.slice(0, 40)) || t.includes(u.slice(0, 40)))) {
      return;
    }
    unique.push(t);
  };

  for (const x of lower) {
    const raw = x.current.trim();
    if (!raw) continue;
    const sections = splitMarkdownSections(raw);
    if (sections.length > 0) {
      for (const s of sections) push(s.body);
      continue;
    }
    const paras = raw.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (paras.length > 1) {
      for (const p of paras) push(p);
    } else {
      push(firstSentence(raw) || raw);
    }
  }
  return unique;
}

function splitMarkdownSections(raw: string): Array<{ title: string; body: string }> {
  if (!/^##\s+\S+/m.test(raw)) return [];
  const chunks = raw.split(/\n(?=##\s+)/);
  const out: Array<{ title: string; body: string }> = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^##\s+([^\n]+)\n([\s\S]*)$/);
    if (!m) continue;
    const title = m[1]!.trim();
    const body = m[2]!.trim();
    if (!body || /^Current$/i.test(title) || /^History$/i.test(title)) continue;
    out.push({ title, body });
  }
  return out;
}

function stripHeadingLine(s: string): string {
  return s.replace(/^##\s+[^\n]+\n+/, "").trim();
}

type LifeDim = "work" | "life" | "relationships" | "side" | "other";

const DIM_ORDER: LifeDim[] = ["work", "life", "relationships", "side", "other"];

/** Cluster by life dimension; each kept dim → `## ShortTitle` + paragraph(s). */
function fuseByLifeDimensions(
  grains: string[],
  level: "week" | "month" | "year",
): string {
  const buckets: Record<LifeDim, string[]> = {
    work: [],
    life: [],
    relationships: [],
    side: [],
    other: [],
  };
  for (const g of grains) {
    buckets[classifyLifeDim(g)].push(ensureSentence(g));
  }

  const maxPer = level === "year" ? 5 : level === "week" ? 3 : 3;
  const blocks: string[] = [];
  for (const dim of DIM_ORDER) {
    const bits = buckets[dim].slice(0, maxPer);
    if (bits.length === 0) continue;
    const title = sectionTitle(dim, bits);
    const body =
      level === "year"
        ? bits.map(ensureSentence).join("\n\n")
        : bits.map(ensureSentence).join(" ");
    blocks.push(`## ${title}\n\n${body}`);
  }
  return blocks.join("\n\n").trim();
}

/** Content-derived short titles — not a fixed Work／Family taxonomy. */
function sectionTitle(dim: LifeDim, bits: string[]): string {
  const blob = bits.join(" ");
  if (dim === "work") {
    if (/harbor/i.test(blob)) return "Harbor";
    if (/客戶|專案|週會|uat/i.test(blob)) return "專案";
    return "工作";
  }
  if (dim === "side") {
    if (/engram/i.test(blob)) return "Engram";
    if (/replay|虛擬時鐘|dream|capture/i.test(blob)) return "Engram";
    return "側寫";
  }
  if (dim === "relationships") {
    if (/auntie\s*lam|林/i.test(blob)) return "Cafe 與鄰居";
    if (/\bken\b|表哥/i.test(blob)) return "Ken";
    if (/mira|年假|家人|父/i.test(blob)) return "人際";
    return "關係";
  }
  if (dim === "life") {
    if (/cafe|咖啡|auntie/i.test(blob)) return "日常";
    if (/西貢|天氣|週末|京都|抹茶/i.test(blob)) return "生活";
    return "日常";
  }
  return "其他";
}

function classifyLifeDim(text: string): LifeDim {
  const t = text.toLowerCase();
  // Prefer Engram／side when clearly about the product, even if Harbor co-occurs lightly
  const engramHits = (t.match(/engram|dream|replay|虛擬時鐘|memory-chain|capture|extract|approve/g) ?? [])
    .length;
  const harborHits = (t.match(/harbor|david|uat|shipment|mvp|週會|客戶|standup|wireframe/g) ?? [])
    .length;
  if (engramHits > 0 && engramHits >= harborHits) return "side";
  if (harborHits > 0) return "work";
  if (
    /engram|dream|memory-chain|capture|replay|l0|l2|notion|side project|個人知識|虛擬時鐘|jsonl|extract|approve/.test(
      t,
    )
  ) {
    return "side";
  }
  if (/ken|表哥|爸爸|父|家人|auntie|lam|粽|關係|請假.*mira|年假/.test(t)) {
    return "relationships";
  }
  if (/cafe|咖啡|端午|天氣|南丫|京都|抹茶|生活|週末|吃飯|凍檸|曬傷|西貢/.test(t)) {
    return "life";
  }
  if (/harbor|david|mira|uat|standup|client|dashboard|週會|客戶|專案/.test(t)) {
    return "work";
  }
  return "other";
}

/**
 * First sentence only — keep the full sentence; never mid-cut with ….
 * Skips leading week/month openers (`2026-W22-0525 —`, `2026-W22 —`, `2026-05 —`) only;
 * never strips day dates like `2026-05-02。`.
 */
function firstSentence(text: string): string {
  let oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  oneLine = oneLine.replace(
    /^(?:\d{4}-W\d{2}(?:-\d{4})?\s*[:.—-]\s*|\d{4}-\d{2}\s+—\s*)+/u,
    "",
  );
  const cjk = oneLine.match(/^(.+?[。．!？?])(?:\s|$)/u);
  if (cjk) return cjk[1]!;
  const ascii = oneLine.match(/^(.{12,}?[.!?])(?:\s|$)/);
  if (ascii) return ascii[1]!;
  return oneLine;
}

/** Drop nested openers like `During 2026-W23-0601,` / `2026-W23:` / `2026-05 — ` (em dash). */
function stripPeriodPrefix(s: string): string {
  return s
    .replace(/^(?:During|In|Across)\s+\S+\s*[,—:-]\s*/i, "")
    .replace(/^\d{4}-W\d{2}(?:-\d{4})?\s*[,—:-]\s*/i, "")
    .replace(/^\d{4}-\d{2}\s+—\s*/, "")
    .trim();
}

function ensureSentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/[。．!？?]$/u.test(t)) return t;
  if (/\d{4}(?:-W\d{2}(?:-\d{4})?|-\d{2})$/.test(t)) return t; // bare id — don't force `.`
  return t + ".";
}

