export type SceneId = "activities" | "consolidate" | "clarify" | "seek" | "memory";

export type Status = {
  store_dir?: string;
  lock: boolean;
  l1_empty: boolean;
  dream_status: string;
  dream_pending?: {
    dream_run_id: string;
    scope_count: number;
    patch_count: number;
  } | null;
  dream_job?: {
    status?: string;
    phase?: string;
    started_at?: string;
    error?: string;
    log_tail?: Array<{
      ts?: string;
      event?: string;
      message?: string;
      level?: string;
    }>;
  } | null;
  ask_job?: {
    job_id?: string;
    status?: string;
    phase?: string;
    started_at?: string;
    log_tail?: Array<{
      ts?: string;
      event?: string;
      message?: string;
      level?: string;
    }>;
  } | null;
  clock?: {
    mode?: string;
    now?: string;
    today?: string;
    allow_set?: boolean;
  };
};

export type Pending = {
  present: boolean;
  dream_run_id?: string | null;
  scope?: string[];
  report?: string | null;
  draft_summary?: {
    entry_count?: number;
    future_ids?: string[];
    chain_days?: string[];
    chain_summary_days?: string[];
    clarify_distilled_node_ids?: string[];
  } | null;
  node_score_involvements?: Array<{
    id: string;
    category: string;
    reason?: string;
  }>;
};

export function lightState(status: Status | null): string {
  if (!status) return "unknown";
  if (status.lock) return "dreaming";
  return status.dream_status || "unknown";
}

export function lightLabel(
  status: Status | null,
  t: (k: string) => string,
): string {
  if (!status) return "";
  if (status.lock) return t("status.dream.dreaming");
  return translateDreamStatus(status.dream_status, t);
}

export function translateDreamStatus(
  dreamStatus: string,
  t: (k: string) => string,
): string {
  const key = `status.dream.${dreamStatus}`;
  const translated = t(key);
  return translated !== key ? translated : dreamStatus;
}

export function translateDreamPhase(
  phase: string | undefined,
  t: (k: string) => string,
  fallback = "—",
): string {
  if (!phase) return fallback;
  const key = `consolidate.phase.${phase}`;
  const translated = t(key);
  return translated !== key ? translated : phase;
}

export function formatElapsed(startedAt?: string): string {
  if (!startedAt) return "0s";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function formatL1(
  packet: { present?: boolean; summary?: string; node_notes?: Record<string, string> } | null,
  t: (k: string) => string,
): { text: string; empty: boolean } {
  if (!packet) return { text: t("empty.none"), empty: true };
  if (!packet.present) return { text: t("empty.l1_cleared"), empty: true };
  const parts: string[] = [];
  if (packet.summary?.trim()) parts.push(packet.summary.trim());
  else parts.push(t("empty.summary_blank"));
  const notes =
    packet.node_notes && Object.keys(packet.node_notes).length
      ? Object.entries(packet.node_notes)
          .map(([id, md]) => `### ${id}\n${md || t("empty.blank")}`)
          .join("\n\n")
      : null;
  if (notes) parts.push("---\nnode notes\n\n" + notes);
  return { text: parts.join("\n\n"), empty: false };
}

export function adviceFor(status: Status | null, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (!status) return t("advice.none");
  if (status.lock) return t("advice.lock");
  if (status.dream_status === "pending_review") return t("advice.pending_review");
  if (status.dream_status === "l1_clear_pending") return t("advice.l1_clear_pending");
  if (status.dream_status === "dream_incomplete") return t("advice.dream_incomplete");
  if (status.l1_empty) {
    if (status.dream_status === "never_dreamed") return t("advice.never_dreamed");
    return t("advice.l1_empty");
  }
  return t("advice.ready");
}
