import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { engramApi, type ClarifyAskingItem } from "../lib/api";
import { serializeHash } from "../lib/hashRoute";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { Msg } from "../components/ui";

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

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.95L4 21l1.1-4.2A8.5 8.5 0 1 1 20.5 11.5Z" />
    </svg>
  );
}

export function ClarifyScene() {
  const { t, locale } = useI18n();
  const { status, dreaming } = useStatus();
  const [items, setItems] = useState<ClarifyAskingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [aside, setAside] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asideBusy, setAsideBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const locked = !!(status?.lock || dreaming);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await engramApi.memories.clarify.listAsking();
    if (!ok) {
      setMsg({
        text: data.message || data.error || t("clarify.load_error"),
        kind: "error",
      });
      setItems([]);
    } else {
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (openId) replyRef.current?.focus();
  }, [openId]);

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
    setOpenId(null);
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
    if (openId === id) setOpenId(null);
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
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpenId(null);
    }
  }

  return (
    <section className="scene is-active" role="tabpanel">
      <div className="scene-header">
        <p className="scene-lead">{t("clarify.lead")}</p>
        <button type="button" className="btn ghost scene-refresh" onClick={() => void refresh()}>
          {t("clarify.refresh")}
        </button>
      </div>

      {locked ? <p className="lock-hint">{t("clarify.lock_hint")}</p> : null}
      <Msg text={msg.text} kind={msg.kind} />

      <div className="clarify-feed-wrap">
        <h2 className="sr-only">{t("clarify.prompts_title")}</h2>
        {loading ? (
          <p className="empty-hint">{t("clarify.loading")}</p>
        ) : items.length === 0 ? (
          <p className="empty-hint">{t("clarify.prompts_empty")}</p>
        ) : (
          <ul className="clarify-feed">
            {items.map((item) => {
              const open = openId === item.id;
              const busy = busyId === item.id;
              const replyId = `clarify-reply-${item.id}`;
              return (
                <li key={item.id} className={`clarify-post${open ? " is-open" : ""}`}>
                  <div className="clarify-avatar-col" aria-hidden="true">
                    <span className="clarify-avatar">{t("clarify.post_author").slice(0, 1)}</span>
                  </div>
                  <div className="clarify-post-main">
                    <div className="clarify-post-head">
                      <span className="clarify-post-author">{t("clarify.post_author")}</span>
                      {item.created_at ? (
                        <time
                          className="clarify-post-time"
                          dateTime={item.created_at}
                          title={new Date(item.created_at).toLocaleString()}
                        >
                          {formatPostTime(item.created_at, t, locale)}
                        </time>
                      ) : null}
                    </div>
                    <p className="clarify-post-body">{item.question}</p>
                    {item.related_nodes.length > 0 ? (
                      <div className="clarify-post-tags">
                        {item.related_nodes.map((node) => (
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
                    <div className="clarify-post-actions">
                      <button
                        type="button"
                        className={`clarify-icon-btn${open ? " is-open" : ""}`}
                        aria-expanded={open}
                        aria-controls={replyId}
                        aria-label={open ? t("clarify.comment_collapse") : t("clarify.comment_expand")}
                        disabled={busy}
                        onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                      >
                        <CommentIcon />
                        <span>{t("clarify.comment")}</span>
                      </button>
                      <button
                        type="button"
                        className="clarify-icon-btn clarify-icon-btn-quiet"
                        disabled={locked || busy}
                        onClick={() => void onDismiss(item.id)}
                      >
                        {t("clarify.dismiss")}
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <>
                      <div className="clarify-avatar-col is-reply" aria-hidden="true">
                        <span className="clarify-avatar is-you">{t("clarify.you").slice(0, 1)}</span>
                      </div>
                      <div className="clarify-reply-main" id={replyId}>
                        <label className="sr-only" htmlFor={`${replyId}-input`}>
                          {t("clarify.answer_label")}
                        </label>
                        <textarea
                          id={`${replyId}-input`}
                          ref={replyRef}
                          className="clarify-answer"
                          rows={3}
                          value={answers[item.id] ?? ""}
                          disabled={locked || busy}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onKeyDown={(e) => onReplyKeyDown(e, item.id)}
                          placeholder={t("clarify.reply_placeholder")}
                        />
                        <div className="clarify-reply-actions">
                          <button
                            type="button"
                            className="btn primary"
                            disabled={locked || busy}
                            onClick={() => void onSubmit(item.id)}
                          >
                            {t("clarify.reply")}
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={busy}
                            onClick={() => setOpenId(null)}
                          >
                            {t("clarify.reply_cancel")}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form className="clarify-aside" onSubmit={(e) => void onAside(e)}>
        <div className="clarify-avatar-col" aria-hidden="true">
          <span className="clarify-avatar is-you">{t("clarify.you").slice(0, 1)}</span>
        </div>
        <div className="clarify-aside-main">
          <h2 className="clarify-aside-title">{t("clarify.aside_title")}</h2>
          <p className="clarify-aside-lead">{t("clarify.aside_lead")}</p>
          <label className="sr-only" htmlFor="clarify-aside-input">
            {t("clarify.aside_label")}
          </label>
          <textarea
            id="clarify-aside-input"
            className="clarify-aside-input"
            rows={4}
            value={aside}
            disabled={locked || asideBusy}
            onChange={(e) => setAside(e.target.value)}
            placeholder={t("clarify.aside_placeholder")}
          />
          <button type="submit" className="btn" disabled={locked || asideBusy}>
            {t("clarify.aside_submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
