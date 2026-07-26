import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatL1, parseNodeRefs } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";

export function ActivitiesScene() {
  const { t } = useI18n();
  const { status, dreaming, refreshStatus } = useStatus();
  const [raw, setRaw] = useState("");
  const [refs, setRefs] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [l1Text, setL1Text] = useState(t("activities.loading"));
  const [l1Empty, setL1Empty] = useState(false);

  const locked = !!(status?.lock || dreaming);

  const refreshL1 = useCallback(async () => {
    const { ok, data } = await api<{
      present?: boolean;
      summary?: string;
      node_notes?: Record<string, string>;
      message?: string;
      error?: string;
    }>("/memories/short-term-memory");
    if (!ok) {
      setL1Text(data?.message || data?.error || t("empty.l1_load"));
      setL1Empty(true);
      return;
    }
    const { text, empty } = formatL1(data, t);
    setL1Text(text);
    setL1Empty(empty);
  }, [t]);

  useEffect(() => {
    void refreshL1();
  }, [refreshL1]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = raw.trim();
    if (!trimmed) {
      setMsg({ text: t("activities.empty_input"), kind: "error" });
      return;
    }
    if (status?.lock) {
      setMsg({ text: t("activities.lock_hint"), kind: "error" });
      return;
    }
    const body: Record<string, unknown> = { raw: trimmed, source: "web" };
    const nodeRefs = parseNodeRefs(refs);
    if (nodeRefs.length) body.node_refs = nodeRefs;

    setMsg({ text: t("activities.writing"), kind: "" });
    const { ok, status: http, data } = await api<{
      event_id?: string;
      error?: string;
      message?: string;
    }>("/activities", { method: "POST", body: JSON.stringify(body) });

    if (http === 409 || data?.error === "dream_locked") {
      setMsg({ text: data?.message || t("activities.locked"), kind: "error" });
      await refreshStatus();
      return;
    }
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("activities.fail", { status: http }),
        kind: "error",
      });
      return;
    }
    setMsg({ text: t("activities.ok", { id: data.event_id ?? "" }), kind: "ok" });
    setRaw("");
    setRefs("");
    await Promise.all([refreshStatus(), refreshL1()]);
  }

  return (
    <section className="scene is-active" role="tabpanel">
      <p className="scene-lead">{t("activities.lead")}</p>
      <form className="activities-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="activities-raw">
          {t("activities.label_raw")}
        </label>
        <textarea
          id="activities-raw"
          rows={8}
          placeholder={t("activities.placeholder")}
          required
          disabled={locked}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="form-row">
          <label className="field-inline">
            <span>{t("activities.node_refs")}</span>
            <input
              type="text"
              placeholder={t("activities.refs_placeholder")}
              autoComplete="off"
              disabled={locked}
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={locked}>
            {t("activities.submit")}
          </button>
        </div>
        {locked ? <p className="form-hint">{t("activities.lock_hint")}</p> : null}
        <Msg text={msg.text} kind={msg.kind} />
      </form>
      <div className="l1-panel">
        <div className="panel-head">
          <h2>{t("activities.l1_title")}</h2>
          <button type="button" className="btn ghost" onClick={() => void refreshL1()}>
            {t("activities.refresh")}
          </button>
        </div>
        <MdBlock text={l1Text} empty={l1Empty} />
      </div>
    </section>
  );
}
