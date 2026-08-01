/** Mock + file-deliverable CLI agents for higher-chain rollup planner／writer. */

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";
import type {
  RollupAgent,
  RollupPlan,
  RollupPlanContext,
  RollupWriteContext,
} from "../dream/rollup";
import {
  isCurrentMonth,
  isCurrentWeek,
  isCurrentYear,
} from "../store/memories/chain-time";
import { draftDir } from "../store/dreams/dream-runs";
import { setDreamJobAgentPid } from "../store/dreams/dream-job";
import { loadPrompt, renderPrompt } from "./prompt-template";
import { withTempJsonContext } from "./temp-context";
import { runAgentCommand } from "./subprocess";

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

  if (unique.length === 0) {
    const body = ctx.prior_current.trim()
      ? `Earlier themes still held; lower layers added little new.`
      : `Little was recorded in lower memory layers.`;
    return `## Note\n\n${body}`;
  }

  return fuseByLifeDimensions(unique, ctx.level === "year" ? "year" : ctx.level === "month" ? "month" : "week");
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

function parsePlanJson(raw: string): RollupPlan {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("rollup plan: no JSON object in result file");
  }
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as RollupPlan;
  if (!obj || typeof obj !== "object") throw new Error("rollup plan: invalid JSON");
  return obj;
}

/**
 * If an agent left process narration above the first `##`, keep from that title.
 * Prefer empty preamble (file deliverable); this is defense in depth.
 */
export function stripRollupWriterPreamble(text: string): string {
  const m = text.match(/^##\s+\S/m);
  if (!m || m.index == null) return text.trim();
  let body = text.slice(m.index);
  const lines = body.split(/\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (
      i > 0 &&
      !line.startsWith("##") &&
      /^(Reading |Checking |Writing |Looking |Saved |Created |已寫入|以下是)/.test(
        line,
      )
    ) {
      break;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

async function readRequiredFile(path: string, label: string): Promise<string> {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} result file missing: ${path}`);
  }
  return (await readFile(path, "utf8")).trim();
}

type RollupInvokeOpts = {
  /** Extra dirs Cursor may Write／Read (e.g. draft root). */
  extraAddDirs?: string[];
};

/** Spawn CLI to perform file work; deliverable is on disk — stdout is ignored. */
async function runClaudeRollup(
  prompt: string,
  workDir: string,
  dreamRunId: string,
  _opts?: RollupInvokeOpts,
): Promise<void> {
  const cmd = [
    config.claudeBin,
    "-p",
    prompt,
    "--output-format",
    "text",
    "--allowedTools",
    "Read,Write",
  ];
  await runAgentCommand({
    cmd,
    cwd: workDir,
    processKey: `dream:${dreamRunId}`,
    onPid: (pid) => setDreamJobAgentPid(pid),
    exitErrorLabel: "rollup agent",
  });
}

async function runCursorRollup(
  prompt: string,
  workDir: string,
  dreamRunId: string,
  opts?: RollupInvokeOpts,
): Promise<void> {
  const cmd = [
    config.cursorAgentBin,
    "-p",
    prompt,
    "--output-format",
    "json",
    "--yolo",
    "--add-dir",
    workDir,
  ];
  for (const dir of opts?.extraAddDirs ?? []) {
    cmd.push("--add-dir", dir);
  }
  await runAgentCommand({
    cmd,
    cwd: workDir,
    processKey: `dream:${dreamRunId}`,
    onPid: (pid) => setDreamJobAgentPid(pid),
    exitErrorLabel: "rollup agent",
  });
}

type RollupInvoker = (
  prompt: string,
  workDir: string,
  dreamRunId: string,
  opts?: RollupInvokeOpts,
) => Promise<void>;

/** Shared plan／write flow; deliverables are files (stdout ignored). */
class CliRollupAgent implements RollupAgent {
  constructor(private readonly invoke: RollupInvoker) {}

  async plan(ctx: RollupPlanContext): Promise<RollupPlan> {
    const promptPath = join(import.meta.dir, "../../prompts/rollup-plan.md");
    const template = await loadPrompt(promptPath);
    return withTempJsonContext(
      {
        prefix: "engram-rollup-plan",
        filename: "plan-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const resultPath = join(workDir, "plan.json");
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          RESULT_PATH: resultPath,
          DREAM_RUN_ID: ctx.dream_run_id,
          LEVEL: ctx.level,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: ctx.memory_language,
        });
        await this.invoke(prompt, workDir, ctx.dream_run_id);
        const raw = await readRequiredFile(resultPath, "rollup plan");
        return parsePlanJson(raw);
      },
    );
  }

  async write(ctx: RollupWriteContext): Promise<string> {
    const promptPath = join(
      import.meta.dir,
      `../../prompts/rollup-write-${ctx.level}.md`,
    );
    const template = await loadPrompt(promptPath);
    const draftRoot = draftDir(ctx.dream_run_id);
    return withTempJsonContext(
      {
        prefix: "engram-rollup-write",
        filename: "write-context.json",
        value: ctx,
      },
      async (workDir, ctxPath) => {
        const prompt = renderPrompt(template, {
          CONTEXT_PATH: ctxPath,
          OUTPUT_PATH: ctx.output_path,
          OUTPUT_REL: ctx.output_rel,
          DREAM_RUN_ID: ctx.dream_run_id,
          LEVEL: ctx.level,
          ID: ctx.id,
          OPERATION: ctx.operation,
          TODAY: ctx.today,
          NOW: ctx.now,
          TIMEZONE: ctx.timezone,
          MEMORY_LANGUAGE: ctx.memory_language,
        });
        await this.invoke(prompt, workDir, ctx.dream_run_id, {
          extraAddDirs: [draftRoot],
        });
        const raw = await readRequiredFile(ctx.output_path, "rollup write");
        return stripRollupWriterPreamble(raw);
      },
    );
  }
}

/** Claude Code rollup agent (prompts under server/prompts/). */
export class ClaudeRollupAgent extends CliRollupAgent {
  constructor() {
    super(runClaudeRollup);
  }
}

/** Cursor CLI rollup agent (prompts under server/prompts/). */
export class CursorRollupAgent extends CliRollupAgent {
  constructor() {
    super(runCursorRollup);
  }
}

export function pickRollupAgent(): RollupAgent {
  const mode = process.env.ENGRAM_AGENT ?? "claude";
  if (mode === "mock-ok" || mode === "mock-fail" || mode === "mock-ask-ok") {
    return new MockRollupAgent();
  }
  if (mode === "cursor") return new CursorRollupAgent();
  return new ClaudeRollupAgent();
}

/** Heuristic used only in docs/tests — mirrors mock planner flags. */
export function periodIsCurrent(
  level: "week" | "month" | "year",
  id: string,
  today: string,
): boolean {
  if (level === "week") return isCurrentWeek(id, today);
  if (level === "month") return isCurrentMonth(id, today);
  return isCurrentYear(id, today);
}

