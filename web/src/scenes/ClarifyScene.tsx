import { useCallback, useEffect, useState, type FormEvent } from "react";
import { engramApi, type ClarifyAskingItem } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { Msg } from "../components/ui";

export function ClarifyScene() {
  const { t } = useI18n();
  const { status, dreaming } = useStatus();
  const [items, setItems] = useState<ClarifyAskingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aside, setAside] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asideBusy, setAsideBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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

      <div className="clarify-prompts">
        <h2 className="clarify-section-title">{t("clarify.prompts_title")}</h2>
        {loading ? (
          <p className="empty-hint">{t("clarify.loading")}</p>
        ) : items.length === 0 ? (
          <p className="empty-hint">{t("clarify.prompts_empty")}</p>
        ) : (
          <ul className="clarify-card-list">
            {items.map((item) => (
              <li key={item.id} className="clarify-card">
                <p className="clarify-question">{item.question}</p>
                {item.related_nodes.length > 0 ? (
                  <p className="clarify-meta">
                    {t("clarify.related", { nodes: item.related_nodes.join(", ") })}
                  </p>
                ) : null}
                <textarea
                  className="clarify-answer"
                  rows={4}
                  value={answers[item.id] ?? ""}
                  disabled={locked || busyId === item.id}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder={t("clarify.answer_placeholder")}
                  aria-label={t("clarify.answer_placeholder")}
                />
                <div className="clarify-card-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={locked || busyId === item.id}
                    onClick={() => void onSubmit(item.id)}
                  >
                    {t("clarify.submit")}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked || busyId === item.id}
                    onClick={() => void onDismiss(item.id)}
                  >
                    {t("clarify.dismiss")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="clarify-aside" onSubmit={(e) => void onAside(e)}>
        <h2 className="clarify-section-title">{t("clarify.aside_title")}</h2>
        <p className="scene-lead clarify-aside-lead">{t("clarify.aside_lead")}</p>
        <textarea
          className="clarify-aside-input"
          rows={5}
          value={aside}
          disabled={locked || asideBusy}
          onChange={(e) => setAside(e.target.value)}
          placeholder={t("clarify.aside_placeholder")}
          aria-label={t("clarify.aside_placeholder")}
        />
        <button type="submit" className="btn" disabled={locked || asideBusy}>
          {t("clarify.aside_submit")}
        </button>
      </form>
    </section>
  );
}
