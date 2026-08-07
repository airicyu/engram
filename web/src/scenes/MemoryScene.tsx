import { useEffect, useMemo, useRef, useState } from "react";
import { engramApi, type ChainLevel, type NodeIndex } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { MdBlock } from "../components/ui";

type MemoryMode = "chain" | "nodes";

type ChainItem = { id: string; preview?: string; range?: string };

export function MemoryScene() {
  const { t } = useI18n();
  const [mode, setMode] = useState<MemoryMode>("chain");
  const [chainLevel, setChainLevel] = useState<ChainLevel>("day");
  const [chainItems, setChainItems] = useState<ChainItem[] | null>(null);
  const [nodes, setNodes] = useState<NodeIndex[] | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [chainMeta, setChainMeta] = useState("");
  const [chainBody, setChainBody] = useState("");
  const [chainEmpty, setChainEmpty] = useState(false);
  const [nodeBody, setNodeBody] = useState("");
  const [nodeEmpty, setNodeEmpty] = useState(false);
  const [nodeScoreMeta, setNodeScoreMeta] = useState("");
  const [filter, setFilter] = useState("");
  const [indexEmpty, setIndexEmpty] = useState("");
  const selectedChainIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedChainIdRef.current = selectedChainId;
  }, [selectedChainId]);

  useEffect(() => {
    if (mode !== "chain") return;
    const controller = new AbortController();
    let cancelled = false;
    setIndexEmpty("");
    setChainBody(t("memory.browse_loading"));
    setChainEmpty(false);

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.chain.index(chainLevel, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!ok) {
          setChainItems([]);
          setIndexEmpty(t("memory.browse_fail"));
          setChainBody(t("memory.browse_fail"));
          setChainEmpty(true);
          return;
        }
        const items =
          chainLevel === "day"
            ? (data.days ?? []).map((item) => ({ id: item.day_id, preview: item.preview }))
            : chainLevel === "week"
              ? (data.weeks ?? []).map((item) => ({
                  id: item.week_id,
                  preview: item.preview,
                  range: item.start && item.end ? `${item.start} – ${item.end}` : undefined,
                }))
              : chainLevel === "month"
                ? (data.months ?? []).map((item) => ({ id: item.month_id, preview: item.preview }))
                : (data.years ?? []).map((item) => ({ id: item.year_id, preview: item.preview }));
        if (!data.present || !items.length) {
          setChainItems([]);
          setIndexEmpty(t("memory.chain_empty"));
          setSelectedChainId(null);
          setChainMeta("");
          setChainBody(t("memory.chain_empty"));
          setChainEmpty(true);
          return;
        }
        setChainItems(items);
        const previous = selectedChainIdRef.current;
        setSelectedChainId(previous && items.some((item) => item.id === previous) ? previous : items[0]!.id);
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setChainItems([]);
        setIndexEmpty(t("memory.browse_fail"));
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chainLevel, mode, t]);

  useEffect(() => {
    if (mode !== "chain" || !selectedChainId) return;
    const controller = new AbortController();
    let cancelled = false;
    setChainMeta("");
    setChainBody(t("memory.browse_loading"));
    setChainEmpty(false);

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.chain.detail(chainLevel, selectedChainId, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!ok) {
          setChainBody(t("memory.browse_fail"));
          setChainEmpty(true);
          return;
        }
        if (!data.present) {
          setChainBody(t("memory.chain_empty"));
          setChainEmpty(true);
          return;
        }
        if (chainLevel === "day") {
          setChainMeta(
            data.source === "summary"
              ? t("memory.source_summary")
              : data.source === "ledger_fallback"
                ? t("memory.source_ledger")
                : data.source || "",
          );
        } else if (chainLevel === "week" && data.start && data.end) {
          setChainMeta(`${data.start} – ${data.end} · ${t("memory.source_summary")}`);
        } else {
          setChainMeta(t("memory.source_summary"));
        }
        setChainBody(data.content?.trim() || t("empty.blank"));
        setChainEmpty(!data.content?.trim());
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chainLevel, mode, selectedChainId, t]);

  useEffect(() => {
    if (mode !== "nodes") return;
    const controller = new AbortController();
    let cancelled = false;
    setIndexEmpty("");
    setNodes(null);
    setSelectedNodeId(null);
    setNodeBody(t("memory.browse_loading"));
    setNodeEmpty(false);

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.nodes.index({ signal: controller.signal });
        if (cancelled) return;
        if (!ok) {
          setNodes([]);
          setIndexEmpty(t("memory.browse_fail"));
          setNodeBody(t("memory.browse_fail"));
          setNodeEmpty(true);
          return;
        }
        if (!data.present || !data.nodes?.length) {
          setNodes([]);
          setIndexEmpty(t("memory.nodes_empty"));
          setNodeBody(t("memory.nodes_empty"));
          setNodeEmpty(true);
          return;
        }
        setNodes(data.nodes);
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setNodes([]);
        setIndexEmpty(t("memory.browse_fail"));
        setNodeBody(t("memory.browse_fail"));
        setNodeEmpty(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, t]);

  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.node.toLowerCase().includes(q) || (n.preview || "").toLowerCase().includes(q),
    );
  }, [nodes, filter]);

  useEffect(() => {
    if (mode !== "nodes" || !nodes?.length) return;
    const next =
      selectedNodeId && filteredNodes.some((n) => n.node === selectedNodeId)
        ? selectedNodeId
        : filteredNodes[0]?.node ?? nodes[0].node;
    if (next !== selectedNodeId) setSelectedNodeId(next);
  }, [filteredNodes, mode, nodes, selectedNodeId]);

  useEffect(() => {
    if (mode !== "nodes" || !selectedNodeId) return;
    const controller = new AbortController();
    let cancelled = false;
    setNodeBody(t("memory.browse_loading"));
    setNodeEmpty(false);
    setNodeScoreMeta("");

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.nodes.detail(selectedNodeId, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!ok) {
          setNodeBody(t("memory.browse_fail"));
          setNodeEmpty(true);
          return;
        }
        if (!data.present) {
          setNodeBody(t("memory.nodes_empty"));
          setNodeEmpty(true);
          return;
        }
        setNodeScoreMeta(
          data.display_score == null
            ? t("memory.score_none")
            : t("memory.score_display", { score: data.display_score }),
        );
        setNodeBody(data.understanding?.trim() || t("empty.no_what"));
        setNodeEmpty(!data.understanding?.trim());
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setNodeBody(t("memory.browse_fail"));
        setNodeEmpty(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, selectedNodeId, t]);

  const levelLabel = (level: ChainLevel) => {
    if (level === "day") return t("memory.chain_level_day");
    if (level === "week") return t("memory.chain_level_week");
    if (level === "month") return t("memory.chain_level_month");
    return t("memory.chain_level_year");
  };

  return (
    <section className="scene scene-fill is-active" role="tabpanel">
      <p className="scene-lead">{t("memory.lead")}</p>
      <div className="memory-modes" role="tablist" aria-label="Memory mode">
        <button
          type="button"
          className={`mode-btn${mode === "chain" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "chain"}
          onClick={() => setMode("chain")}
        >
          {t("memory.mode_chain")}
        </button>
        <button
          type="button"
          className={`mode-btn${mode === "nodes" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "nodes"}
          onClick={() => setMode("nodes")}
        >
          {t("memory.mode_nodes")}
        </button>
      </div>

      {mode === "chain" ? (
        <>
          <div className="memory-modes" role="tablist" aria-label={t("memory.chain_levels")}>
            {(["day", "week", "month", "year"] as ChainLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`mode-btn${chainLevel === level ? " is-active" : ""}`}
                role="tab"
                aria-selected={chainLevel === level}
                onClick={() => {
                  setSelectedChainId(null);
                  setChainLevel(level);
                }}
              >
                {levelLabel(level)}
              </button>
            ))}
          </div>
          <div className="browse-layout">
            <div className="browse-index" role="listbox" aria-label={levelLabel(chainLevel)}>
              {indexEmpty ? (
                <p className="browse-empty">{indexEmpty}</p>
              ) : (
                (chainItems ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`browse-item${item.id === selectedChainId ? " is-selected" : ""}`}
                    role="option"
                    aria-current={item.id === selectedChainId ? "true" : undefined}
                    onClick={() => setSelectedChainId(item.id)}
                  >
                    <span className="browse-item-id">{item.id}</span>
                    {item.range ? (
                      <div className="browse-item-preview">{item.range}</div>
                    ) : null}
                    {item.preview ? (
                      <div className="browse-item-preview">{item.preview}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <article className="browse-detail packet-block">
              <h2>{selectedChainId ?? "—"}</h2>
              <p className="browse-meta">{chainMeta}</p>
              <MdBlock text={chainBody} empty={chainEmpty} />
            </article>
          </div>
        </>
      ) : (
        <div className="browse-layout">
          <div className="browse-sidebar">
            <label className="sr-only" htmlFor="memory-nodes-filter">
              {t("memory.nodes_filter")}
            </label>
            <input
              id="memory-nodes-filter"
              className="browse-filter"
              type="search"
              placeholder={t("memory.nodes_filter")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="browse-index" role="listbox" aria-label={t("memory.mode_nodes")}>
              {indexEmpty ? (
                <p className="browse-empty">{indexEmpty}</p>
              ) : filteredNodes.length === 0 ? (
                <p className="browse-empty">{t("memory.nodes_empty")}</p>
              ) : (
                filteredNodes.map((n) => (
                  <button
                    key={n.node}
                    type="button"
                    className={`browse-item${n.node === selectedNodeId ? " is-selected" : ""}`}
                    role="option"
                    aria-current={n.node === selectedNodeId ? "true" : undefined}
                    onClick={() => setSelectedNodeId(n.node)}
                  >
                    <span className="browse-item-id">
                      {n.node}
                      <span className="browse-item-score">
                        {n.display_score == null
                          ? t("memory.score_none")
                          : t("memory.score_badge", { score: n.display_score })}
                      </span>
                    </span>
                    {n.preview ? (
                      <div className="browse-item-preview">{n.preview}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
          <article className="browse-detail packet-block">
            <h2>{selectedNodeId ?? "—"}</h2>
            {nodeScoreMeta ? <p className="browse-meta">{nodeScoreMeta}</p> : null}
            <MdBlock text={nodeBody} empty={nodeEmpty} />
          </article>
        </div>
      )}
    </section>
  );
}
