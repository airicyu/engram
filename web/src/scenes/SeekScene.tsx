import { useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatElapsed } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";

type SeekMode = "search" | "ask";

type SearchData = {
  l1?: { summary?: string; node_notes?: Record<string, string> } | null;
  chain?: Array<{ day_id: string; content: string }>;
  nodes?: Array<{ node: string; match_reason?: string; what_current?: string }>;
  message?: string;
  error?: string;
};

type AskJob = {
  present?: boolean;
  status?: string;
  phase?: string;
  started_at?: string;
  answer?: string;
  sources?: unknown[];
  error?: string;
  log_tail?: Array<{ ts?: string; event?: string; message?: string; level?: string }>;
};

export function SeekScene() {
  const { t } = useI18n();
  const { askJobId, setAskJobId, askPolling, setAskPolling, status } = useStatus();
  const askAlive = useRef(false);
  const [mode, setMode] = useState<SeekMode>("ask");
  const [q, setQ] = useState("");
  const [askQ, setAskQ] = useState("");
  const [scopes, setScopes] = useState({ l1: true, nodes: true, chain: true });
  const [searchMsg, setSearchMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [askMsg, setAskMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [askAnswer, setAskAnswer] = useState<AskJob | null>(null);
  const [askProgress, setAskProgress] = useState<AskJob | null>(null);

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
    const params = new URLSearchParams({ q: trimmed });
    if (selected.length < 3) params.set("scope", selected.join(","));
    const { ok, data } = await api<SearchData>(`/memories/search?${params}`);
    if (!ok) {
      setSearchMsg({
        text: data?.message || data?.error || t("memory.search_fail"),
        kind: "error",
      });
      return;
    }
    const hits =
      (data.nodes?.length ?? 0) + (data.l1 ? 1 : 0) + (data.chain?.length ?? 0);
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

  async function pollAsk(jobId: string) {
    askAlive.current = true;
    setAskPolling(true);
    while (askAlive.current) {
      const { ok, data } = await api<AskJob>(`/memories/ask/${encodeURIComponent(jobId)}`);
      if (!askAlive.current) break;
      if (!ok || data?.present === false) {
        setAskMsg({ text: t("memory.ask_fail"), kind: "error" });
        break;
      }
      setAskProgress(data);
      if (data.status === "completed") {
        setAskMsg({ text: t("memory.ask_done"), kind: "ok" });
        setAskAnswer(data);
        setAskJobId(null);
        askAlive.current = false;
        setAskPolling(false);
        setAskProgress(null);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        setAskMsg({ text: data.error || t("memory.ask_fail"), kind: "error" });
        setAskJobId(null);
        askAlive.current = false;
        setAskPolling(false);
        setAskProgress(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    setAskPolling(false);
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const trimmed = askQ.trim();
    if (!trimmed) {
      setAskMsg({ text: t("memory.ask_empty"), kind: "error" });
      return;
    }
    setAskMsg({ text: t("memory.ask_running"), kind: "" });
    setAskAnswer(null);
    const { ok, status: http, data } = await api<{
      job_id?: string;
      error?: string;
      message?: string;
    }>("/memories/ask", { method: "POST", body: JSON.stringify({ q: trimmed }) });
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
    const jobId = data.job_id!;
    setAskJobId(jobId);
    void pollAsk(jobId);
  }

  async function onAskCancel() {
    if (!askJobId) return;
    askAlive.current = false;
    await api(`/memories/ask/${encodeURIComponent(askJobId)}/cancel`, {
      method: "POST",
      body: "{}",
    });
    setAskPolling(false);
    setAskJobId(null);
    setAskProgress(null);
    setAskMsg({ text: t("memory.ask_cancelled"), kind: "ok" });
  }

  const liveAsk = askProgress || (status?.ask_job as AskJob | undefined);
  const askActive = askPolling || liveAsk?.status === "running";

  function formatSearchL1(l1: SearchData["l1"]) {
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
              {(["l1", "chain", "nodes"] as const).map((key) => (
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
                        : t("memory.nodes_title")}
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
                    .map((c) => `# ${c.day_id}\n\n${c.content.trim()}`)
                    .join("\n\n---\n\n")}
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
                      text={(n.what_current || "").trim() || t("empty.no_what")}
                      empty={!(n.what_current || "").trim()}
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
