import { useEffect, useMemo, useState, type FormEvent } from "react";
import { engramApi, type AskJob, type AskRecentItem, type MemorySearch } from "../lib/api";
import { formatElapsed } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";
import { useAskJob } from "../hooks/useAskJob";
import { encodeHashId } from "../lib/hashRoute";

type SeekMode = "search" | "ask";

function SeekModeIcon({ mode }: { mode: SeekMode }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 15,
    height: 15,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "mode-btn-icon",
  };
  if (mode === "ask") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 3.1c-.7.4-1 0.7-1 1.6" />
        <circle cx="12" cy="17.1" r="0.85" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.2 16.2 4.3 4.3" />
    </svg>
  );
}

export function SeekScene() {
  const { t } = useI18n();
  const { status } = useStatus();
  const { start, cancel, viewPast, progress: askProgress, answer: askAnswer, failure, isActive } = useAskJob();
  const [mode, setMode] = useState<SeekMode>("ask");
  const [q, setQ] = useState("");
  const [askQ, setAskQ] = useState("");
  const [scopes, setScopes] = useState({ l1: true, nodes: true, chain: true, future: true });
  const [searchMsg, setSearchMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [askMsg, setAskMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [searchData, setSearchData] = useState<MemorySearch | null>(null);
  const [recentAsks, setRecentAsks] = useState<AskRecentItem[]>([]);
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null);

  const knownNodeIds = useMemo(
    () => new Set((searchData?.nodes ?? []).map((n) => n.node)),
    [searchData],
  );

  async function refreshRecent() {
    const { ok, data } = await engramApi.memories.askRecent();
    if (ok && Array.isArray(data.items)) setRecentAsks(data.items);
  }

  useEffect(() => {
    if (mode !== "ask") return;
    void refreshRecent();
  }, [mode, askAnswer?.job_id, failure?.job_id, isActive]);

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
    const { ok, status: http, data } = await start(trimmed);
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
    void refreshRecent();
  }

  async function onRecentClick(item: AskRecentItem) {
    setSelectedRecentId(item.job_id);
    setAskQ(item.q);
    if (item.status === "running") {
      setAskMsg({ text: t("memory.ask_running"), kind: "" });
      return;
    }
    const result = await viewPast(item.job_id);
    if (!result.ok || result.data.present === false) {
      setAskMsg({ text: t("memory.ask_fail"), kind: "error" });
      return;
    }
    if (result.data.q) setAskQ(result.data.q);
    if (result.data.status === "completed") {
      setAskMsg({ text: t("memory.ask_done"), kind: "ok" });
    } else if (result.data.status === "cancelled") {
      setAskMsg({ text: t("memory.ask_cancelled"), kind: "ok" });
    } else {
      setAskMsg({
        text: result.data.error || result.data.message || t("memory.ask_fail"),
        kind: "error",
      });
    }
  }

  function recentStatusLabel(status: string) {
    if (status === "completed") return t("memory.ask_done");
    if (status === "failed") return t("memory.ask_fail");
    if (status === "cancelled") return t("memory.ask_cancelled");
    if (status === "running") return t("memory.ask_running");
    return status;
  }

  const liveAsk = askProgress || (status?.ask_job as AskJob | undefined);
  const askActive = isActive || liveAsk?.status === "running";

  function formatSearchL1(l1: MemorySearch["l1"]) {
    if (!l1) return { text: "", empty: true };
    const entries = l1.entries ?? [];
    if (entries.length === 0) return { text: "", empty: true };
    const text = entries
      .map((e) => `### ${e.id}\n${e.ts}\n\n${e.raw.trim()}`)
      .join("\n\n---\n\n");
    return { text, empty: false };
  }

  return (
    <section className="scene scene-fill is-active seek-col" role="tabpanel">
      <div className="memory-modes seek-modes" role="tablist" aria-label="Seek mode">
        <button
          type="button"
          className={`mode-btn${mode === "ask" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "ask"}
          onClick={() => setMode("ask")}
        >
          <SeekModeIcon mode="ask" />
          {t("seek.mode_ask")}
        </button>
        <button
          type="button"
          className={`mode-btn${mode === "search" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "search"}
          onClick={() => setMode("search")}
        >
          <SeekModeIcon mode="search" />
          {t("seek.mode_search")}
        </button>
      </div>

      {mode === "search" ? (
        <div className="seek-search-pane">
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
                      {f.id ? (
                        <a href={`#/memory/future/${encodeHashId(f.id)}`}>{f.id}</a>
                      ) : (
                        f.id
                      )}{" "}
                      <span>
                        · {f.zone === "longTerm" ? t("memory.zone_long_term") : t("memory.zone_upcoming")}
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
        <div className="seek-ask-pane">
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
            <div className="form-row ask-actions">
              {askActive ? (
                <button type="button" className="btn ghost" onClick={() => void onAskCancel()}>
                  {t("memory.ask_cancel")}
                </button>
              ) : null}
              <button type="submit" className="btn primary" disabled={askActive}>
                {t("memory.ask_submit")}
              </button>
            </div>
          </form>
          <section className="seek-recent-asks" aria-label={t("seek.recent_asks")}>
            <h2 className="seek-recent-asks-title">{t("seek.recent_asks")}</h2>
            {recentAsks.length === 0 ? (
              <p className="seek-recent-asks-empty">{t("seek.recent_empty")}</p>
            ) : (
              <ul className="seek-recent-asks-list">
                {recentAsks.map((item) => (
                  <li key={item.job_id}>
                    <button
                      type="button"
                      className={`seek-recent-asks-item${selectedRecentId === item.job_id ? " is-selected" : ""}`}
                      onClick={() => void onRecentClick(item)}
                    >
                      <span className="seek-recent-asks-q">{item.q}</span>
                      <span className="seek-recent-asks-meta">
                        {item.started_at ? new Date(item.started_at).toLocaleString() : ""}
                        {" · "}
                        {recentStatusLabel(item.status)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
            </article>
          ) : failure?.error && !askActive ? (
            <article className="packet-block">
              <h2>{t("memory.answer_title")}</h2>
              <MdBlock text={failure.error || failure.message || t("memory.ask_fail")} />
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
