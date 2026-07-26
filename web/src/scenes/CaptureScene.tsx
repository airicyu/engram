import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatL1, parseNodeRefs } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";

export function CaptureScene() {
  const { t } = useI18n();
  const { status, dreaming, refreshStatus } = useStatus();
  const [raw, setRaw] = useState("");
  const [refs, setRefs] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [l1Text, setL1Text] = useState(t("capture.loading"));
  const [l1Empty, setL1Empty] = useState(false);

  const locked = !!(status?.lock || dreaming);

  const refreshL1 = useCallback(async () => {
    const { ok, data } = await api<{
      present?: boolean;
      summary?: string;
      node_notes?: Record<string, string>;
      message?: string;
      error?: string;
    }>("/memory/l1");
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
      setMsg({ text: t("capture.empty_input"), kind: "error" });
      return;
    }
    if (status?.lock) {
      setMsg({ text: t("capture.lock_hint"), kind: "error" });
      return;
    }
    const body: Record<string, unknown> = { raw: trimmed, source: "web" };
    const nodeRefs = parseNodeRefs(refs);
    if (nodeRefs.length) body.node_refs = nodeRefs;

    setMsg({ text: t("capture.writing"), kind: "" });
    const { ok, status: http, data } = await api<{
      event_id?: string;
      error?: string;
      message?: string;
    }>("/capture", { method: "POST", body: JSON.stringify(body) });

    if (http === 409 || data?.error === "dream_locked") {
      setMsg({ text: data?.message || t("capture.locked"), kind: "error" });
      await refreshStatus();
      return;
    }
    if (!ok) {
      setMsg({
        text: data?.message || data?.error || t("capture.fail", { status: http }),
        kind: "error",
      });
      return;
    }
    setMsg({ text: t("capture.ok", { id: data.event_id ?? "" }), kind: "ok" });
    setRaw("");
    setRefs("");
    await Promise.all([refreshStatus(), refreshL1()]);
  }

  return (
    <section className="scene is-active" role="tabpanel">
      <p className="scene-lead">{t("capture.lead")}</p>
      <form className="capture-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="capture-raw">
          {t("capture.label_raw")}
        </label>
        <textarea
          id="capture-raw"
          rows={8}
          placeholder={t("capture.placeholder")}
          required
          disabled={locked}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="form-row">
          <label className="field-inline">
            <span>{t("capture.node_refs")}</span>
            <input
              type="text"
              placeholder={t("capture.refs_placeholder")}
              autoComplete="off"
              disabled={locked}
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary" disabled={locked}>
            {t("capture.submit")}
          </button>
        </div>
        {locked ? <p className="form-hint">{t("capture.lock_hint")}</p> : null}
        <Msg text={msg.text} kind={msg.kind} />
      </form>
      <div className="l1-panel">
        <div className="panel-head">
          <h2>{t("capture.l1_title")}</h2>
          <button type="button" className="btn ghost" onClick={() => void refreshL1()}>
            {t("capture.refresh")}
          </button>
        </div>
        <MdBlock text={l1Text} empty={l1Empty} />
      </div>
    </section>
  );
}
