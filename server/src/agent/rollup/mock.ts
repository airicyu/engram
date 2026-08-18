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
  const level: "week" | "month" | "year" =
    ctx.level === "year" ? "year" : ctx.level === "month" ? "month" : "week";
  const nonempty = ctx.lower.filter((x) => x.current.trim());
  const p1 = pickMockP1(ctx);

  let body: string;
  if (nonempty.length === 0) {
    const note = ctx.prior_current.trim()
      ? `Earlier themes still held; lower layers added little new.`
      : `Little was recorded in lower memory layers.`;
    body = `## Note\n\n${note}`;
  } else {
    body = fuseByLifeDimensions(nonempty, level, p1);
  }

  if (!body.includes("[[nodes/")) {
    body = weaveP1(body, p1);
  }
  return body;
}

function pickMockP1(ctx: RollupWriteContext): string {
  const blob = [...ctx.lower.map((x) => x.current), ctx.prior_current].join("\n");
  const m = /\[\[nodes\/([^/\]]+)\/\1(?:\|[^\]]*)?\]\]/.exec(blob);
  return m ? m[0]! : "[[nodes/acme/acme|acme]]";
}

function weaveP1(body: string, p1: string): string {
  const paraBreak = body.indexOf("\n\n");
  if (paraBreak < 0) return `${body} Also ${p1}.`;
  const head = body.slice(0, paraBreak);
  const rest = body.slice(paraBreak);
  return `${head} Also ${p1}.${rest}`;
}

type LifeDim = "work" | "life" | "relationships" | "side" | "other";

const DIM_ORDER: LifeDim[] = ["work", "life", "relationships", "side", "other"];

type Distilled = { dim: LifeDim; sentence: string; source: string };

/** Cluster by life dimension; rewrite — never paste a full lower current. */
function fuseByLifeDimensions(
  lower: Array<{ id: string; current: string }>,
  level: "week" | "month" | "year",
  p1: string,
): string {
  const distilled: Distilled[] = lower.map((x) => {
    const source = x.current.trim();
    const dim = classifyLifeDim(source);
    return { dim, sentence: distillLower(source, level), source };
  });

  const needTwoSections = (level === "week" || level === "month") && lower.length >= 2;
  const sections = groupSections(distilled, needTwoSections);
  if (needTwoSections) {
    const hasTwoParas = sections.some((s) => s.paras.length >= 2);
    if (!hasTwoParas && sections[0]) {
      sections[0].paras.push(quietBeat(level, p1));
    }
  }

  return sections
    .map((s) => `## ${s.title}\n\n${s.paras.join("\n\n")}`)
    .join("\n\n")
    .trim();
}

function groupSections(
  distilled: Distilled[],
  needTwoSections: boolean,
): Array<{ title: string; paras: string[] }> {
  const buckets: Record<LifeDim, Distilled[]> = {
    work: [],
    life: [],
    relationships: [],
    side: [],
    other: [],
  };
  for (const d of distilled) buckets[d.dim].push(d);

  const fromDims: Array<{ title: string; paras: string[] }> = [];
  for (const dim of DIM_ORDER) {
    const bits = buckets[dim];
    if (bits.length === 0) continue;
    fromDims.push({
      title: sectionTitle(
        dim,
        bits.map((b) => `${b.source} ${b.sentence}`),
      ),
      paras: bits.map((b) => b.sentence),
    });
  }

  if (!needTwoSections || fromDims.length >= 2) return fromDims;
  if (distilled.length < 2) return fromDims;

  const first = distilled[0]!;
  const rest = distilled.slice(1);
  return [
    {
      title: sectionTitle(first.dim, [`${first.source} ${first.sentence}`]),
      paras: [first.sentence],
    },
    {
      title: sectionTitle(
        rest[0]!.dim === first.dim ? "other" : rest[0]!.dim,
        rest.map((r) => `${r.source} ${r.sentence}`),
      ),
      paras: rest.map((r) => r.sentence),
    },
  ];
}

/** Mock-authored sentence that must not equal the full lower blob. */
function distillLower(current: string, level: "week" | "month" | "year"): string {
  const token = extractToken(current);
  const framed =
    level === "year"
      ? `The year’s through-line around ${token} held.`
      : level === "month"
        ? `This month the ${token} rhythm continued.`
        : `This week the ${token} thread mattered.`;
  const trimmed = current.trim();
  if (framed === trimmed || trimmed.includes(framed)) {
    return `Retrospective on ${token}.`;
  }
  return framed;
}

function extractToken(raw: string): string {
  const stripped = raw
    .replace(/\[\[nodes\/[^|\]]+\|([^\]]+)\]\]/g, "$1")
    .replace(/^#+\s+[^\n]+\n+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 16) return "this thread";
  const words = stripped.split(" ").filter((w) => w.length > 0).slice(0, 3);
  const token = words.join(" ").replace(/[。．.!?？]+$/u, "");
  if (!token || token === stripped) {
    return stripped.slice(0, Math.min(12, Math.floor(stripped.length / 2))).trim() || "this thread";
  }
  return token;
}

function quietBeat(level: "week" | "month" | "year", p1: string): string {
  const when = level === "year" ? "year" : level === "month" ? "month" : "week";
  return `The rest of the ${when} stayed quiet on this line (${p1}).`;
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

