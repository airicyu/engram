/** GET /dreams/reports and GET /dreams/reports/{id} — committed reports still on disk. */

import { readDreamRun, readReport, listDreamRuns } from "../../store/dreams/dream-runs";
import { extractNarrativeBody } from "../../dream/report/finalize";
import { answerPreview } from "../../store/dreams/ask-history";

export type DreamReportListItem = {
  dream_run_id: string;
  created_at: string;
  committed_at: string;
  patch_count: number;
  l1_clear_pending: boolean;
  narrative_preview: string | null;
};

export function isValidDreamRunId(id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return true;
}

function sortKey(run: { committed_at?: string; created_at: string }): string {
  return run.committed_at || run.created_at;
}

export function narrativePreview(report: string): string | null {
  const body = extractNarrativeBody(report);
  const collapsed = body.replace(/\s+/g, " ").trim();
  return answerPreview(collapsed || null);
}

async function itemFromCommitted(
  id: string,
  created_at: string,
  committed_at: string | undefined,
  patch_count: number,
  l1_clear_pending: boolean | undefined,
): Promise<DreamReportListItem | null> {
  const report = await readReport(id);
  if (report == null) return null;
  return {
    dream_run_id: id,
    created_at,
    committed_at: committed_at || created_at,
    patch_count,
    l1_clear_pending: Boolean(l1_clear_pending),
    narrative_preview: narrativePreview(report),
  };
}

export async function listCommittedReports(): Promise<DreamReportListItem[]> {
  const runs = await listDreamRuns();
  const committed = runs.filter((r) => r.status === "committed");
  committed.sort((a, b) => {
    const t = sortKey(b).localeCompare(sortKey(a));
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  const items: DreamReportListItem[] = [];
  for (const r of committed) {
    const item = await itemFromCommitted(
      r.id,
      r.created_at,
      r.committed_at,
      r.patch_count,
      r.l1_clear_pending,
    );
    if (item) items.push(item);
  }
  return items;
}

export async function handleDreamReportsList(): Promise<Response> {
  const items = await listCommittedReports();
  return Response.json({ items });
}

export async function handleDreamReportGet(id: string): Promise<Response> {
  if (!isValidDreamRunId(id)) {
    return Response.json(
      { error: "invalid_dream_run_id", message: "dream_run_id contains invalid characters" },
      { status: 400 },
    );
  }
  const run = await readDreamRun(id);
  const report = await readReport(id);
  if (!run || run.status !== "committed" || report == null) {
    return Response.json({ present: false });
  }
  return Response.json({
    present: true,
    dream_run_id: run.id,
    created_at: run.created_at,
    committed_at: run.committed_at || run.created_at,
    patch_count: run.patch_count,
    l1_clear_pending: Boolean(run.l1_clear_pending),
    report,
  });
}
