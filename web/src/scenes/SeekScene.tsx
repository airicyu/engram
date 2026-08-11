import { useEffect, useMemo, useState, type FormEvent } from "react";
import { engramApi, type AskJob, type MemorySearch } from "../lib/api";
import { formatElapsed } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";
import { useAskJob } from "../hooks/useAskJob";

type SeekMode = "search" | "ask";

export function SeekScene() {
  const { t } = useI18n();
  const { status } = useStatus();
  const { start, cancel, progress: askProgress, answer: askAnswer, failure, isActive } = useAskJob();
  const [mode, setMode] = useState<SeekMode>("ask");
  const [q, setQ] = useState("");
  const [askQ, setAskQ] = useState("");
  const [scopes, setScopes] = useState({ l1: true, nodes: true, chain: true, future: true });
  const [includeLater, setIncludeLater] = useState(false);
  const [searchMsg, setSearchMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [askMsg, setAskMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [searchData, setSearchData] = useState<MemorySearch | null>(null);

  const knownNodeIds = useMemo(
    () => new Set((searchData?.nodes ?? []).map((n) => n.node)),
    [searchData],
  );

  useEffect(() => {
    if (askAnswer?.status === "completed") {
      setAskMsg({ text: t("memory.ask_done"), kind: "ok" });
    }
  }, [askAnswer, t]);

  useEffect(() => {
    if (failure) {
      setAskMsg({ text: failure.error || failure.message || t("memory.ask_fail"), kind: "error" });
    }
  }, [failure, t]);

  function toggleScope(key: keyof typeof scopes) {
    setScopes((s) => ({ ...s, [key]: !s[key] }));
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchMsg({ text: t("memory.search_empty_q"), kind: "error" });
      return;
    }
    const selected = (Object.keys(scopes) as Array<keyof typeof scopes>).filter((k) => scopes[k]);
    if (!selected.length) {
      setSearchMsg({ text: t("memory.search_scope_empty"), kind: "error" });
      return;
    }
    setSearchMsg({ text: t("memory.querying"), kind: "" });
    const { ok, data } = await engramApi.memories.search({
      q: trimmed,
      ...(selected.length < 4 ? { scope: selected } : {}),
    });
    if (!ok) {
      setSearchMsg({
        text: data?.message || data?.error || t("memory.search_fail"),
        kind: "error",
      });
      return;
    }
    const hits =
      (data.nodes?.length ?? 0) +
      (data.l1 ? 1 : 0) +
      (data.chain?.length ?? 0) +
      (data.future_sight?.length ?? 0);
    setSearchMsg({
      text: hits ? t("memory.search_hits", { count: hits }) : t("memory.search_empty"),
      kind: "ok",
    });
    setSearchData(data);
  }

  function askEventLabel(ev: { event?: string; message?: string }) {
    const key = `memory.log.${ev.event}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return ev.message || ev.event || "";
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const trimmed = askQ.trim();
    if (!trimmed) {
      setAskMsg({ text: t("memory.ask_empty"), kind: "error" });
      return;
    }
    setAskMsg({ text: t("memory.ask_running"), kind: "" });
    const { ok, status: http, data } = await start(trimmed, includeLater);
    if (http === 409 && data?.error === "ask_busy") {
      setAskMsg({ text: t("memory.ask_busy"), kind: "error" });
      return;
    }
    if (!ok) {
      setAskMsg({
        text: data?.message || data?.error || t("memory.ask_fail"),
        kind: "error",
      });
      return;
    }
  }

  async function onAskCancel() {
    const result = await cancel();
    if (!result?.ok) {
      setAskMsg({ text: result?.data.error || result?.data.message || t("memory.ask_fail"), kind: "error" });
      return;
    }
    setAskMsg({ text: t("memory.ask_cancelled"), kind: "ok" });
  }

  const liveAsk = askProgress || (status?.ask_job as AskJob | undefined);
  const askActive = isActive || liveAsk?.status === "running";

  function formatSearchL1(l1: MemorySearch["l1"]) {
    if (!l1) return { text: "", empty: true };
    const parts: string[] = [];
    if (l1.summary?.trim()) parts.push(l1.summary.trim());
    const notes = Object.entries(l1.node_notes ?? {})
      .filter(([, md]) => md?.trim())
      .map(([id, md]) => `### ${id}\n${md!.trim()}`);
    if (notes.length) parts.push(notes.join("\n\n"));
    const text = parts.join("\n\n");
    return { text, empty: !text };
  }

  return (
    <section className="scene is-active" role="tabpanel">
      <div className="memory-modes seek-modes" role="tablist" aria-label="Seek mode">
        <button
          type="button"
          className={`mode-btn${mode === "ask" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "ask"}
          onClick={() => setMode("ask")}
        >
          {t("seek.mode_ask")}
        </button>
        <button
          type="button"
          className={`mode-btn${mode === "search" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "search"}
          onClick={() => setMode("search")}
        >
          {t("seek.mode_search")}
        </button>
      </div>

      {mode === "search" ? (
        <div>
          <p className="scene-lead">{t("seek.lead")}</p>
          <form className="recall-form" onSubmit={onSearch}>
            <label className="sr-only" htmlFor="seek-search-q">
              {t("memory.label_q")}
            </label>
            <input
              id="seek-search-q"
              type="search"
              required
              placeholder={t("memory.placeholder")}
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn primary">
              {t("memory.search_submit")}
            </button>
            <div className="search-scopes" role="group">
              <span className="search-scopes-label">{t("memory.search_scope")}</span>
              {(["l1", "chain", "nodes", "future"] as const).map((key) => (
                <label key={key} className="search-scope-option">
                  <input
                    type="checkbox"
                    checked={scopes[key]}
                    onChange={() => toggleScope(key)}
                  />
                  <span>
                    {key === "l1"
                      ? t("memory.l1_title")
                      : key === "chain"
                        ? t("memory.chain_title")
                        : key === "nodes"
                          ? t("memory.nodes_title")
                          : t("memory.future_title")}
                  </span>
                </label>
              ))}
            </div>
          </form>
          <Msg text={searchMsg.text} kind={searchMsg.kind} />
          {searchData && "l1" in searchData ? (
            <article className="packet-block">
              <h2>{t("memory.l1_title")}</h2>
              {searchData.l1 ? (
                (() => {
                  const l1 = formatSearchL1(searchData.l1);
                  return <MdBlock text={l1.text} empty={l1.empty} />;
                })()
              ) : (
                <MdBlock text={t("empty.no_l1_hit")} empty />
              )}
            </article>
          ) : null}
          {searchData && "chain" in searchData ? (
            <article className="packet-block">
              <h2>{t("memory.chain_title")}</h2>
              {(searchData.chain ?? []).length ? (
                <MdBlock
                  text={(searchData.chain ?? [])
                    .map((c) => `# ${c.day_id || c.id}\n\n${c.content.trim()}`)
                    .join("\n\n---\n\n")}
                  knownNodeIds={knownNodeIds}
                />
              ) : (
                <MdBlock text={t("empty.no_chain")} empty />
              )}
            </article>
          ) : null}
          {searchData && "nodes" in searchData ? (
            <article className="packet-block">
              <h2>{t("memory.nodes_title")}</h2>
              {(searchData.nodes ?? []).length === 0 ? (
                <MdBlock text={t("empty.no_nodes")} empty />
              ) : (
                (searchData.nodes ?? []).map((n) => (
                  <div key={n.node} className="node-card">
                    <h3>
                      {n.node} <span>· {n.match_reason || ""}</span>
                    </h3>
                    <MdBlock
                      text={(n.understanding || "").trim() || t("empty.no_what")}
                      empty={!(n.understanding || "").trim()}
                      knownNodeIds={knownNodeIds}
                    />
                  </div>
                ))
              )}
            </article>
          ) : null}
          {searchData && "future_sight" in searchData ? (
            <article className="packet-block">
              <h2>{t("memory.future_title")}</h2>
              {(searchData.future_sight ?? []).length === 0 ? (
                <MdBlock text={t("empty.no_future")} empty />
              ) : (
                (searchData.future_sight ?? []).map((f) => (
                  <div key={`${f.zone}-${f.id}`} className="node-card">
                    <h3>
                      {f.id}{" "}
                      <span>
                        · {f.zone}
                        {f.match_reason ? ` · ${f.match_reason}` : ""}
                        {f.anchor_start
                          ? ` · ${f.anchor_start}${f.anchor_end && f.anchor_end !== f.anchor_start ? `→${f.anchor_end}` : ""}`
                          : ""}
                      </span>
                    </h3>
                    <MdBlock
                      text={(f.content || "").trim() || t("empty.no_what")}
                      empty={!(f.content || "").trim()}
                    />
                  </div>
                ))
              )}
            </article>
          ) : null}
        </div>
      ) : (
        <div>
          <p className="scene-lead">{t("memory.ask_lead")}</p>
          <form className="recall-form ask-form" onSubmit={onAsk}>
            <label className="sr-only" htmlFor="seek-ask-q">
              {t("memory.ask_label")}
            </label>
            <textarea
              id="seek-ask-q"
              rows={4}
              required
              placeholder={t("memory.ask_placeholder")}
              value={askQ}
              onChange={(e) => setAskQ(e.target.value)}
            />
            <label className="search-scope-option ask-include-later">
              <input
                type="checkbox"
                checked={includeLater}
                onChange={(e) => setIncludeLater(e.target.checked)}
                disabled={askActive}
              />
              <span>{t("memory.ask_include_later")}</span>
            </label>
            <div className="form-row">
              <button type="submit" className="btn primary" disabled={askActive}>
                {t("memory.ask_submit")}
              </button>
              {askActive ? (
                <button type="button" className="btn ghost" onClick={() => void onAskCancel()}>
                  {t("memory.ask_cancel")}
                </button>
              ) : null}
            </div>
          </form>
          <Msg text={askMsg.text} kind={askMsg.kind} />
          {askActive && liveAsk ? (
            <div className="dream-progress">
              <p className="dream-progress-meta">
                {t("memory.ask_progress", {
                  phase: liveAsk.phase || "—",
                  elapsed: formatElapsed(liveAsk.started_at),
                })}
              </p>
              <ol className="dream-log">
                {(liveAsk.log_tail ?? []).map((ev, i) => {
                  const time = ev.ts ? new Date(ev.ts).toLocaleTimeString() : "";
                  const label = askEventLabel(ev);
                  return (
                    <li key={i} className={ev.level === "error" ? "is-error" : ""}>
                      {time ? `${time}  ${label}` : label}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
          {askAnswer?.answer ? (
            <article className="packet-block">
              <h2>{t("memory.answer_title")}</h2>
              <MdBlock text={askAnswer.answer} />
              {(askAnswer.sources ?? []).length ? (
                <details>
                  <summary>{t("memory.sources_title")}</summary>
                  <MdBlock text={JSON.stringify(askAnswer.sources, null, 2)} />
                </details>
              ) : null}
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
