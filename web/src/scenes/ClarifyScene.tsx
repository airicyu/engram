import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { engramApi, type ClarifyAskingItem } from "../lib/api";
import { serializeHash } from "../lib/hashRoute";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { Msg, RefreshIcon } from "../components/ui";

function formatPostTime(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return t("clarify.time_just_now");
  if (diff < hour) return t("clarify.time_minutes", { n: Math.max(1, Math.floor(diff / minute)) });
  if (diff < day) return t("clarify.time_hours", { n: Math.max(1, Math.floor(diff / hour)) });
  if (diff < 7 * day) return t("clarify.time_days", { n: Math.max(1, Math.floor(diff / day)) });
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-Hant", {
    month: "short",
    day: "numeric",
  });
}

export function ClarifyScene() {
  const { t, locale } = useI18n();
  const { status, dreaming } = useStatus();
  const [items, setItems] = useState<ClarifyAskingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aside, setAside] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asideBusy, setAsideBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const locked = !!(status?.lock || dreaming);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await engramApi.memories.clarify.listAsking();
    if (!ok) {
      setMsg({
        text: data.message || data.error || t("clarify.load_error"),
        kind: "error",
      });
      setItems([]);
      setSelectedId(null);
    } else {
      const next = data.items ?? [];
      setItems(next);
      setSelectedId((prev) => {
        if (prev && next.some((item) => item.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) replyRef.current?.focus();
  }, [selectedId]);

  async function onSubmit(id: string) {
    if (locked) {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    const answer = (answers[id] ?? "").trim();
    if (!answer) {
      setMsg({ text: t("clarify.answer_required"), kind: "error" });
      return;
    }
    setBusyId(id);
    const { ok, status: http, data } = await engramApi.memories.clarify.submit(id, { answer });
    setBusyId(null);
    if (http === 409 || data.error === "dream_locked") {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    if (!ok) {
      setMsg({ text: data.message || data.error || t("clarify.submit_error"), kind: "error" });
      return;
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMsg({ text: t("clarify.submit_ok"), kind: "ok" });
    await refresh();
  }

  async function onDismiss(id: string) {
    if (locked) {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    setBusyId(id);
    const { ok, status: http, data } = await engramApi.memories.clarify.dismiss(id);
    setBusyId(null);
    if (http === 409 || data.error === "dream_locked") {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    if (!ok) {
      setMsg({ text: data.message || data.error || t("clarify.dismiss_error"), kind: "error" });
      return;
    }
    setMsg({ text: t("clarify.dismiss_ok"), kind: "ok" });
    await refresh();
  }

  async function onAside(e: FormEvent) {
    e.preventDefault();
    if (locked) {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    const raw = aside.trim();
    if (!raw) {
      setMsg({ text: t("clarify.aside_required"), kind: "error" });
      return;
    }
    setAsideBusy(true);
    const { ok, status: http, data } = await engramApi.memories.clarify.aside({ raw });
    setAsideBusy(false);
    if (http === 409 || data.error === "dream_locked") {
      setMsg({ text: t("clarify.locked"), kind: "error" });
      return;
    }
    if (!ok) {
      setMsg({ text: data.message || data.error || t("clarify.aside_error"), kind: "error" });
      return;
    }
    setAside("");
    setMsg({ text: t("clarify.aside_ok"), kind: "ok" });
  }

  function onReplyKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, id: string) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void onSubmit(id);
    }
  }

  const busy = selected ? busyId === selected.id : false;

  return (
    <section className="scene is-active inbox-scene" aria-label={t("nav.inbox")}>
      <div className="scene-header">
        <p className="scene-lead">{t("clarify.lead")}</p>
        <button
          type="button"
          className="icon-btn scene-refresh"
          onClick={() => void refresh()}
          data-tooltip={t("clarify.refresh")}
          aria-label={t("clarify.refresh")}
        >
          <RefreshIcon />
        </button>
      </div>

      {locked ? <p className="lock-hint">{t("clarify.lock_hint")}</p> : null}
      <Msg text={msg.text} kind={msg.kind} />

      {loading || items.length === 0 ? (
        <div className="inbox-layout is-empty">
          <p className="empty-hint">
            {loading ? t("clarify.loading") : t("clarify.prompts_empty")}
          </p>
        </div>
      ) : (
      <div className="inbox-layout">
        <div className="inbox-list">
          <h2 className="sr-only">{t("clarify.prompts_title")}</h2>
          <ul className="inbox-threads">
            {items.map((item) => {
              const on = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`inbox-thread${on ? " is-active" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="inbox-thread-author">{t("clarify.post_author")}</span>
                    {item.created_at ? (
                      <time className="inbox-thread-time" dateTime={item.created_at}>
                        {formatPostTime(item.created_at, t, locale)}
                      </time>
                    ) : null}
                    <span className="inbox-thread-preview">{item.question}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="inbox-pane">
          {!selected ? (
            <p className="empty-hint">{t("clarify.thread_empty")}</p>
          ) : (
            <>
              <div className="inbox-message">
                <div className="inbox-message-head">
                  <span className="clarify-post-author">{t("clarify.post_author")}</span>
                  {selected.created_at ? (
                    <time
                      className="clarify-post-time"
                      dateTime={selected.created_at}
                      title={new Date(selected.created_at).toLocaleString()}
                    >
                      {formatPostTime(selected.created_at, t, locale)}
                    </time>
                  ) : null}
                </div>
                <p className="clarify-post-body">{selected.question}</p>
                {selected.related_nodes.length > 0 ? (
                  <div className="clarify-post-tags">
                    {selected.related_nodes.map((node) => (
                      <a
                        key={node}
                        className="clarify-tag"
                        href={serializeHash({ scene: "memory", memory: { mode: "nodes", id: node } })}
                      >
                        @{node}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="sr-only" htmlFor="inbox-reply">
                {t("clarify.answer_label")}
              </label>
              <textarea
                id="inbox-reply"
                ref={replyRef}
                className="clarify-answer"
                rows={5}
                value={answers[selected.id] ?? ""}
                disabled={locked || busy}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [selected.id]: e.target.value }))
                }
                onKeyDown={(e) => onReplyKeyDown(e, selected.id)}
                placeholder={t("clarify.reply_placeholder")}
              />
              <div className="inbox-pane-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={locked || busy}
                  onClick={() => void onSubmit(selected.id)}
                >
                  {t("clarify.submit")}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={locked || busy}
                  onClick={() => void onDismiss(selected.id)}
                >
                  {t("clarify.dismiss")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      <form className="clarify-aside inbox-aside" onSubmit={(e) => void onAside(e)}>
        <div className="clarify-aside-main">
          <h2 className="clarify-aside-title">{t("clarify.aside_title")}</h2>
          <p className="clarify-aside-lead">{t("clarify.aside_lead")}</p>
          <label className="sr-only" htmlFor="clarify-aside-input">
            {t("clarify.aside_label")}
          </label>
          <textarea
            id="clarify-aside-input"
            className="clarify-aside-input"
            rows={3}
            value={aside}
            disabled={locked || asideBusy}
            onChange={(e) => setAside(e.target.value)}
            placeholder={t("clarify.aside_placeholder")}
          />
          <div className="inbox-aside-actions">
            <button type="submit" className="btn primary" disabled={locked || asideBusy}>
              {t("clarify.aside_submit")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
