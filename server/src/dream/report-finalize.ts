/**
 * Finalize dream report: keep AI narrative; server fills Scope／Events／
 * Node score involvements／Appendix from frozen scope + draft manifest／deletes.
 */

import { access, readFile, writeFile } from "node:fs/promises";
import type { PoolEntry } from "../store/memories/short-term-memory";
import { readManifest } from "../store/dreams/draft";
import { readDraftDeletes } from "../store/dreams/file-pipeline";
import { reportPath } from "../store/dreams/dream-runs";
import { config } from "../config";
import { calendarDate } from "../store/memories/activities";
import {
  formatInvolvementsSection,
  readInvolvementsForPending,
} from "./node-score-involvements";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const REQUIRED_HEADINGS = [
  "# Dream report",
  "## Scope",
  "## Events covered",
  "## Narrative",
  "### Timeline",
  "### Long-term updates",
  "### Near future",
  "### Uncertainties",
  "## Appendix — pending deploy",
  "### Paths",
] as const;

/**
 * Extract narrative block between ## Narrative and the next server-owned section.
 * Truncates at ## Node score involvements or ## Appendix (whichever first).
 */
function extractNarrative(md: string): string {
  const m = md.match(
    /## Narrative\s*\n([\s\S]*?)(?=\n## Node score involvements\b|\n## Appendix — pending deploy\b|$)/,
  );
  if (m) return m[1].trim();
  // Fallback: build minimal narrative skeleton
  return [
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
    "_None_",
  ].join("\n");
}

function extractRetryFeedback(md: string): string {
  const m = md.match(/## Retry feedback\s*\n([\s\S]*?)(?=\n## Scope\b)/);
  return m ? `## Retry feedback\n\n${m[1].trim()}\n\n` : "";
}

/** Validate agent report has required structure (soft: warn via throw if missing title). */
export function assertReportSkeleton(md: string, dreamRunId: string): void {
  if (!md.includes(`# Dream report — ${dreamRunId}`) && !md.includes("# Dream report")) {
    throw new Error("dream report missing title heading");
  }
  for (const h of ["## Narrative", "### Timeline", "### Long-term updates", "### Near future", "### Uncertainties"]) {
    if (!md.includes(h)) {
      throw new Error(`dream report missing section: ${h}`);
    }
  }
  void REQUIRED_HEADINGS;
}

/** Rebuild report with server-owned Scope／Events／Appendix; preserve AI narrative. */
export async function finalizeDreamReport(opts: {
  dream_run_id: string;
  scope: string[];
  events: PoolEntry[];
  review_feedback?: {
    reason: string;
    previous_summary: string;
    previous_changes: string[];
    retried_from: string;
  };
  rollup_section?: string;
}): Promise<string> {
  const path = reportPath(opts.dream_run_id);
  let raw = "";
  if (await exists(path)) {
    raw = await readFile(path, "utf8");
  }
  if (raw.trim()) {
    assertReportSkeleton(raw, opts.dream_run_id);
  }

  const narrative = raw.trim()
    ? extractNarrative(raw)
    : [
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
        "_None_",
      ].join("\n");

  let retry = extractRetryFeedback(raw);
  if (!retry && opts.review_feedback) {
    const fb = opts.review_feedback;
    const lines = [
      "## Retry feedback",
      "",
      `- **retried_from:** \`${fb.retried_from}\``,
      `- **reason:** ${fb.reason.trim()}`,
      "",
    ];
    if (fb.previous_summary.trim()) {
      lines.push("### Previous draft summary", "", fb.previous_summary.trim(), "");
    }
    if (fb.previous_changes.length) {
      lines.push("### Previous changes", "");
      for (const c of fb.previous_changes) lines.push(`- ${c}`);
      lines.push("");
    }
    retry = lines.join("\n");
  }

  const manifest = await readManifest(opts.dream_run_id);
  const deletes = await readDraftDeletes(opts.dream_run_id);
  const pathLines: string[] = [];
  if (manifest) {
    for (const e of manifest.entries) {
      pathLines.push(`- ${e.op} \`${e.path}\``);
    }
  }
  for (const d of deletes) {
    pathLines.push(`- delete \`${d}\``);
  }
  if (pathLines.length === 0) {
    pathLines.push("- _(no file changes — approve clears short-term scope only)_");
  }

  const today = calendarDate();
  const lines: string[] = [
    `# Dream report — ${opts.dream_run_id}`,
    "",
    `Generated: ${today} (${config.timezone})`,
    "",
  ];
  if (retry) lines.push(retry.replace(/\n+$/, ""), "");

  lines.push("## Scope", "");
  if (opts.scope.length === 0) lines.push("- (empty)");
  else for (const id of opts.scope) lines.push(`- \`${id}\``);
  lines.push("");

  lines.push("## Events covered", "");
  if (opts.events.length === 0) lines.push("_No events in scope._");
  else {
    for (const e of opts.events) {
      lines.push(`- **${e.id}** [${e.ts}] ${e.raw.trim()}`);
    }
  }
  lines.push("");

  lines.push("## Narrative", narrative.trim(), "");

  // Server-owned: Node score involvements (between Narrative and Appendix; before rollup).
  const involvements = await readInvolvementsForPending(opts.dream_run_id);
  lines.push(formatInvolvementsSection(involvements), "");

  if (opts.rollup_section?.trim()) {
    lines.push(opts.rollup_section.trim(), "");
  }

  lines.push("## Appendix — pending deploy", "### Paths", "", ...pathLines, "");

  const out = lines.join("\n");
  await writeFile(path, out.endsWith("\n") ? out : `${out}\n`, "utf8");
  return out;
}
