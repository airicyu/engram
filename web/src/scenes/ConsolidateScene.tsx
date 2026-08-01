import { useState } from "react";
import { api } from "../lib/api";
import {
  adviceFor,
  formatElapsed,
  translateDreamPhase,
  translateDreamStatus,
} from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";

export function ConsolidateScene() {
  const { t } = useI18n();
  const { status, pending, dreaming, setDreaming, refreshStatus } = useStatus();
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [resultBody, setResultBody] = useState<string | null>(null);
  const [retryReason, setRetryReason] = useState("");
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const dash = t("consolidate.dash");
  const pendingReview = status?.dream_status === "pending_review";
  const clearRetry = status?.dream_status === "l1_clear_pending";
  const dreamDisabled =
    !status ||
    status.lock ||
    dreaming ||
    pendingReview ||
    clearRetry ||
    status.l1_empty;
  const canReview = !!(pendingReview || clearRetry) && !status?.lock && !dreaming;
  const canRetry =
    pendingReview && !status?.lock && !dreaming && retryReason.trim().length > 0;
  const job = status?.dream_job ?? null;
  const progressActive = !!(status?.lock || dreaming || job?.status === "running");

  function dreamBtnLabel() {
    if (status?.lock || dreaming) return t("consolidate.dreaming");
    return t("consolidate.dream");
  }

  function dreamEventLabel(ev: { event?: string; message?: string }) {
    const key = `consolidate.log.${ev.event}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return ev.message || ev.event || "";
  }

  async function onDreamRun() {
    if (status?.lock || dreaming) {
      setMsg({ text: t("dream.already"), kind: "error" });
      return;
    }
    if (pendingReview) {
      setMsg({ text: t("dream.pending_blocks_run"), kind: "error" });
      return;
    }
    if (status?.l1_empty) {
      setMsg({ text: t("dream.l1_empty"), kind: "error" });
      return;
    }
    setDreaming(true);
    setMsg({ text: t("dream.running"), kind: "" });
    const { ok, status: http, data } = await api<{
      job_id?: string;
      message?: string;
      error?: string;
    }>("/dreams/run", { method: "POST" });

    if (http === 409) {
      setDreaming(false);
      setResultBody(data?.message || data?.error || "rejected");
      setMsg({ text: data?.message || data?.error || t("dream.rejected"), kind: "error" });
      await refreshStatus();
      return;
    }
    if (!ok) {
      setDreaming(false);
      setResultBody(JSON.stringify(data, null, 2));
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      await refreshStatus();
      return;
    }
    setMsg({ text: t("dream.submitted"), kind: "ok" });
    setResultBody(`job_id: ${data.job_id}\n${data.message || ""}`);
    await refreshStatus();
  }

  async function onApprove() {
    setMsg({ text: t("dream.approving"), kind: "" });
    const { ok, status: http, data } = await api<{
      empty_patches?: boolean;
      l1_clear_pending?: boolean;
      committed?: string[];
      message?: string;
      error?: string;
    }>("/dreams/approve", { method: "POST", body: "{}" });
    if (http === 409) {
      setMsg({ text: data?.message || data?.error || t("dream.approve_fail"), kind: "error" });
      await refreshStatus();
      return;
    }
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      return;
    }
    const note = data.empty_patches
      ? t("dream.approve_empty")
      : data.l1_clear_pending
        ? t("dream.approve_retry_clear")
        : t("dream.approve_ok", { count: data.committed?.length ?? 0 });
    setMsg({ text: note, kind: data.l1_clear_pending ? "error" : "ok" });
    setResultBody(JSON.stringify(data, null, 2));
    setRetryReason("");
    await refreshStatus();
  }

  async function onDiscard() {
    setMsg({ text: t("dream.discarding"), kind: "" });
    const { ok, status: http, data } = await api<{ message?: string; error?: string }>(
      "/dreams/discard",
      { method: "POST", body: "{}" },
    );
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      await refreshStatus();
      return;
    }
    setMsg({ text: t("dream.discard_ok"), kind: "ok" });
    setRetryReason("");
    await refreshStatus();
  }

  async function onPatchCategory(id: string, category: string) {
    setPatchingId(id);
    setMsg({ text: "", kind: "" });
    const { ok, status: http, data } = await api<{
      ok?: boolean;
      category?: string;
      message?: string;
      error?: string;
    }>("/dreams/pending/node-score-involvements", {
      method: "PATCH",
      body: JSON.stringify({ id, category }),
    });
    setPatchingId(null);
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      return;
    }
    setMsg({ text: t("consolidate.involvement_patched", { id, category }), kind: "ok" });
    await refreshStatus();
  }

  async function onRetry() {
    const reason = retryReason.trim();
    if (!reason) {
      setMsg({ text: t("dream.retry_need_reason"), kind: "error" });
      return;
    }
    if (status?.lock || dreaming) {
      setMsg({ text: t("dream.already"), kind: "error" });
      return;
    }
    setDreaming(true);
    setMsg({ text: t("dream.retrying"), kind: "" });
    const { ok, status: http, data } = await api<{
      job_id?: string;
      message?: string;
      error?: string;
    }>("/dreams/retry", {
      method: "POST",
      body: JSON.stringify({
        reason,
        ...(pending?.dream_run_id ? { dream_run_id: pending.dream_run_id } : {}),
      }),
    });

    if (http === 400 || http === 409) {
      setDreaming(false);
      setMsg({ text: data?.message || data?.error || t("dream.retry_fail"), kind: "error" });
      await refreshStatus();
      return;
    }
    if (!ok) {
      setDreaming(false);
      setResultBody(JSON.stringify(data, null, 2));
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      await refreshStatus();
      return;
    }
    setRetryReason("");
    setMsg({ text: t("dream.retry_submitted"), kind: "ok" });
    setResultBody(`job_id: ${data.job_id}\n${data.message || ""}`);
    await refreshStatus();
  }

  async function onCancel() {
    setMsg({ text: t("dream.cancelling"), kind: "" });
    const { ok, status: http, data } = await api<{ message?: string; error?: string }>(
      "/dreams/cancel",
      { method: "POST", body: "{}" },
    );
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("dream.fail", { status: http }),
        kind: "error",
      });
      await refreshStatus();
      return;
    }
    setDreaming(false);
    setMsg({ text: t("dream.cancel_ok"), kind: "ok" });
    await refreshStatus();
  }

  const pendingMeta = pending?.present
    ? [
        pending.dream_run_id ? t("pending.meta_run", { id: pending.dream_run_id }) : null,
        pending.scope ? t("pending.meta_scope", { count: pending.scope.length }) : null,
        pending.draft_summary
          ? t("pending.meta_draft", { count: pending.draft_summary.entry_count ?? 0 })
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const progressPhase = translateDreamPhase(
    job?.phase || (status?.lock ? "extract" : undefined),
    t,
    dash,
  );

  return (
    <section className="scene is-active" role="tabpanel">
      <p className="scene-lead">{t("consolidate.lead")}</p>
      <div className="status-panel">
        <dl className="status-grid">
          <div>
            <dt>{t("consolidate.label_dream_status")}</dt>
            <dd>{status ? translateDreamStatus(status.dream_status, t) : dash}</dd>
          </div>
          <div>
            <dt>{t("consolidate.label_lock")}</dt>
            <dd>
              {status
                ? status.lock
                  ? t("status.value.true")
                  : t("status.value.false")
                : dash}
            </dd>
          </div>
          <div>
            <dt>{t("memory.l1_title")}</dt>
            <dd>
              {status
                ? status.l1_empty
                  ? t("status.value.empty")
                  : t("status.value.present")
                : dash}
            </dd>
          </div>
        </dl>
        <p className="status-advice">{adviceFor(status, t)}</p>
      </div>

      {pending?.present ? (
        <div className="pending-panel">
          <h2>{t("consolidate.pending_title")}</h2>
          <p className="pending-meta">{pendingMeta}</p>
          <MdBlock
            text={pending.report?.trim() || t("pending.no_report")}
            empty={!pending.report?.trim()}
          />
          {pendingReview && (pending.node_score_involvements?.length ?? 0) > 0 ? (
            <div className="involvements-panel">
              <h3>{t("consolidate.involvements_title")}</h3>
              <p className="involvements-hint">{t("consolidate.involvements_hint")}</p>
              <ul className="involvements-list">
                {(pending.node_score_involvements ?? []).map((row) => (
                  <li key={row.id} className="involvements-row">
                    <span className="involvements-id">{row.id}</span>
                    <label className="sr-only" htmlFor={`inv-cat-${row.id}`}>
                      {t("consolidate.involvement_category_label", { id: row.id })}
                    </label>
                    <select
                      id={`inv-cat-${row.id}`}
                      className="involvements-select"
                      value={row.category}
                      disabled={!!status?.lock || dreaming || patchingId === row.id}
                      onChange={(e) => void onPatchCategory(row.id, e.target.value)}
                    >
                      <option value="mention">{t("consolidate.category.mention")}</option>
                      <option value="update">{t("consolidate.category.update")}</option>
                      <option value="focus">{t("consolidate.category.focus")}</option>
                    </select>
                    {row.reason ? (
                      <span className="involvements-reason">{row.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="consolidate-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!canReview && !clearRetry}
              onClick={() => void onApprove()}
            >
              {t("consolidate.approve")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!pendingReview || !!status?.lock || dreaming}
              onClick={() => void onDiscard()}
            >
              {t("consolidate.discard")}
            </button>
          </div>
          {pendingReview ? (
            <div className="retry-panel">
              <label className="retry-label" htmlFor="dream-retry-reason">
                {t("consolidate.retry_reason_label")}
              </label>
              <textarea
                id="dream-retry-reason"
                className="retry-reason"
                rows={3}
                value={retryReason}
                disabled={!!status?.lock || dreaming}
                placeholder={t("consolidate.retry_reason_placeholder")}
                onChange={(e) => setRetryReason(e.target.value)}
              />
              <div className="consolidate-actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!canRetry}
                  onClick={() => void onRetry()}
                >
                  {t("consolidate.retry")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!pendingReview && !clearRetry ? (
        <div className="consolidate-actions">
          <button
            type="button"
            className="btn primary"
            disabled={dreamDisabled}
            onClick={() => void onDreamRun()}
          >
            {dreamBtnLabel()}
          </button>
          <button type="button" className="btn ghost" onClick={() => void refreshStatus()}>
            {t("consolidate.refresh")}
          </button>
        </div>
      ) : (
        <div className="consolidate-actions">
          <button type="button" className="btn ghost" onClick={() => void refreshStatus()}>
            {t("consolidate.refresh")}
          </button>
        </div>
      )}
      <Msg text={msg.text} kind={msg.kind} />

      {progressActive ? (
        <div className="dream-progress">
          <p className="dream-progress-meta">
            {t("consolidate.progress_phase", {
              phase: progressPhase,
              elapsed: formatElapsed(job?.started_at),
            })}
          </p>
          <ol className="dream-log">
            {(job?.log_tail ?? []).map((ev, i) => {
              const time = ev.ts ? new Date(ev.ts).toLocaleTimeString() : "";
              const label = dreamEventLabel(ev);
              return (
                <li key={i} className={ev.level === "error" ? "is-error" : ""}>
                  {time ? `${time}  ${label}` : label}
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn ghost" onClick={() => void onCancel()}>
            {t("consolidate.cancel")}
          </button>
        </div>
      ) : null}

      {resultBody != null ? (
        <div className="dream-result">
          <h2>{t("consolidate.result_title")}</h2>
          <MdBlock text={resultBody} />
        </div>
      ) : null}
    </section>
  );
}
