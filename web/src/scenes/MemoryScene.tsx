import { useEffect, useMemo, useRef, useState } from "react";
import {
  engramApi,
  type ChainLevel,
  type FutureSightAnchor,
  type NodeGraphEdge,
  type NodeIndex,
} from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { MdBlock } from "../components/ui";
import { NodeNetworkGraph } from "../components/NodeNetworkGraph";
import type { MemoryHash } from "../lib/hashRoute";

type MemoryMode = "chain" | "nodes" | "future";

function previewContent(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 80) return collapsed;
  return `${collapsed.slice(0, 80)}…`;
}

function formatAnchorRange(start?: string, end?: string): string {
  if (!start) return "";
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

type ChainItem = { id: string; preview?: string; range?: string };

export function MemoryScene({
  route,
  onRouteChange,
}: {
  route: MemoryHash;
  onRouteChange: (route: MemoryHash, history: "push" | "replace") => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<MemoryMode>(route.mode);
  const [chainLevel, setChainLevel] = useState<ChainLevel>(
    route.mode === "chain" && route.level ? route.level : "day",
  );
  const [chainItems, setChainItems] = useState<ChainItem[] | null>(null);
  const [nodes, setNodes] = useState<NodeIndex[] | null>(null);
  const [graphEdges, setGraphEdges] = useState<NodeGraphEdge[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(
    route.mode === "chain" && route.id ? route.id : null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    route.mode === "nodes" && route.id ? route.id : null,
  );
  const [futureAnchors, setFutureAnchors] = useState<FutureSightAnchor[] | null>(null);
  const [selectedFutureId, setSelectedFutureId] = useState<string | null>(
    route.mode === "future" && route.id ? route.id : null,
  );
  const [futureMeta, setFutureMeta] = useState("");
  const [futureBody, setFutureBody] = useState("");
  const [futureEmpty, setFutureEmpty] = useState(false);
  const [chainMeta, setChainMeta] = useState("");
  const [chainBody, setChainBody] = useState("");
  const [chainEmpty, setChainEmpty] = useState(false);
  const [nodeBody, setNodeBody] = useState("");
  const [nodeEmpty, setNodeEmpty] = useState(false);
  const [nodeScoreMeta, setNodeScoreMeta] = useState("");
  const [filter, setFilter] = useState("");
  const [nodeSearchMode, setNodeSearchMode] = useState<"title" | "title_summary">("title");
  const [indexEmpty, setIndexEmpty] = useState("");
  const selectedChainIdRef = useRef<string | null>(selectedChainId);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const selectedFutureIdRef = useRef<string | null>(selectedFutureId);
  const applyingRouteRef = useRef(false);

  useEffect(() => {
    selectedChainIdRef.current = selectedChainId;
  }, [selectedChainId]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    selectedFutureIdRef.current = selectedFutureId;
  }, [selectedFutureId]);

  // Apply deep-link / back-forward route into local state.
  useEffect(() => {
    applyingRouteRef.current = true;
    if (route.mode === "chain") {
      setMode("chain");
      if (route.level) setChainLevel(route.level);
      if (route.id !== undefined) setSelectedChainId(route.id);
    } else if (route.mode === "nodes") {
      setMode("nodes");
      if (route.id !== undefined) setSelectedNodeId(route.id);
    } else {
      setMode("future");
      if (route.id !== undefined) setSelectedFutureId(route.id);
    }
    queueMicrotask(() => {
      applyingRouteRef.current = false;
    });
  }, [route]);

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
        if (previous) {
          // Keep deep-linked id even if missing from index (detail shows empty／fail).
          setSelectedChainId(previous);
        } else {
          const first = items[0]!.id;
          setSelectedChainId(first);
          if (!applyingRouteRef.current) {
            onRouteChange({ mode: "chain", level: chainLevel, id: first }, "replace");
          }
        }
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
  }, [chainLevel, mode, onRouteChange, t]);

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
    setGraphEdges([]);
    setNodeBody(t("memory.browse_loading"));
    setNodeEmpty(false);

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.nodes.graph({ signal: controller.signal });
        if (cancelled) return;
        if (!ok) {
          setNodes([]);
          setGraphEdges([]);
          setIndexEmpty(t("memory.browse_fail"));
          setNodeBody(t("memory.browse_fail"));
          setNodeEmpty(true);
          return;
        }
        if (!data.present || !data.nodes?.length) {
          setNodes([]);
          setGraphEdges([]);
          setIndexEmpty(t("memory.nodes_empty"));
          setNodeBody(t("memory.nodes_empty"));
          setNodeEmpty(true);
          return;
        }
        setNodes(data.nodes);
        setGraphEdges(data.edges ?? []);
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setNodes([]);
        setGraphEdges([]);
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

  const knownNodeIds = useMemo(
    () => new Set((nodes ?? []).map((n) => n.node)),
    [nodes],
  );

  useEffect(() => {
    if (mode !== "nodes" || !nodes?.length) return;
    const current = selectedNodeIdRef.current;
    if (current) return;
    const first = nodes[0]!.node;
    setSelectedNodeId(first);
    if (!applyingRouteRef.current) {
      onRouteChange({ mode: "nodes", id: first }, "replace");
    }
  }, [mode, nodes, onRouteChange]);

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

  useEffect(() => {
    if (mode !== "future") return;
    const controller = new AbortController();
    let cancelled = false;
    setIndexEmpty("");
    setFutureAnchors(null);
    setFutureBody(t("memory.browse_loading"));
    setFutureEmpty(false);
    setFutureMeta("");

    void (async () => {
      try {
        const { ok, data } = await engramApi.memories.futureSight({
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!ok) {
          setFutureAnchors([]);
          setIndexEmpty(t("memory.browse_fail"));
          setFutureBody(t("memory.browse_fail"));
          setFutureEmpty(true);
          return;
        }
        const items = data.anchors ?? [];
        if (!items.length) {
          setFutureAnchors([]);
          setIndexEmpty(t("memory.future_empty"));
          const previous = selectedFutureIdRef.current;
          if (previous) {
            setSelectedFutureId(previous);
          } else {
            setSelectedFutureId(null);
            setFutureMeta("");
            setFutureBody(t("memory.future_empty"));
            setFutureEmpty(true);
          }
          return;
        }
        setFutureAnchors(items);
        const previous = selectedFutureIdRef.current;
        if (previous) {
          setSelectedFutureId(previous);
        } else {
          const first = items[0]!.id;
          setSelectedFutureId(first);
          if (!applyingRouteRef.current) {
            onRouteChange({ mode: "future", id: first }, "replace");
          }
        }
      } catch (error) {
        if (cancelled || (error as DOMException).name === "AbortError") return;
        setFutureAnchors([]);
        setIndexEmpty(t("memory.browse_fail"));
        setFutureBody(t("memory.browse_fail"));
        setFutureEmpty(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, onRouteChange, t]);

  useEffect(() => {
    if (mode !== "future") return;
    if (!selectedFutureId) {
      setFutureMeta("");
      setFutureBody(t("memory.future_empty"));
      setFutureEmpty(true);
      return;
    }
    const items = futureAnchors ?? [];
    const found = items.find((a) => a.id === selectedFutureId);
    if (!found) {
      if (futureAnchors === null) return;
      setFutureMeta(selectedFutureId);
      setFutureBody(t("memory.future_missing"));
      setFutureEmpty(true);
      return;
    }
    const range = formatAnchorRange(found.anchor_start, found.anchor_end);
    const zoneLabel = found.zone === "longTerm" ? t("memory.zone_long_term") : t("memory.zone_upcoming");
    setFutureMeta([found.id, zoneLabel, range].filter(Boolean).join(" · "));
    const text = (found.content ?? "").trim();
    setFutureBody(text || t("empty.blank"));
    setFutureEmpty(!text);
  }, [futureAnchors, mode, selectedFutureId, t]);

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
          onClick={() => {
            setMode("chain");
            onRouteChange(
              {
                mode: "chain",
                level: chainLevel,
                id: selectedChainId ?? undefined,
              },
              "push",
            );
          }}
        >
          {t("memory.mode_chain")}
        </button>
        <button
          type="button"
          className={`mode-btn${mode === "nodes" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "nodes"}
          onClick={() => {
            setMode("nodes");
            onRouteChange(
              { mode: "nodes", id: selectedNodeId ?? undefined },
              "push",
            );
          }}
        >
          {t("memory.mode_nodes")}
        </button>
        <button
          type="button"
          className={`mode-btn${mode === "future" ? " is-active" : ""}`}
          role="tab"
          aria-selected={mode === "future"}
          onClick={() => {
            setMode("future");
            onRouteChange(
              { mode: "future", id: selectedFutureId ?? undefined },
              "push",
            );
          }}
        >
          {t("memory.mode_future")}
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
                  onRouteChange({ mode: "chain", level }, "push");
                }}
              >
                {levelLabel(level)}
              </button>
            ))}
          </div>
          <div className="browse-layout browse-layout-chain">
            <div
              className="browse-index browse-index-card"
              role="listbox"
              aria-label={levelLabel(chainLevel)}
            >
              {indexEmpty ? (
                <p className="browse-empty">{indexEmpty}</p>
              ) : (
                (chainItems ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`browse-item browse-item-chain${item.id === selectedChainId ? " is-selected" : ""}`}
                    role="option"
                    aria-current={item.id === selectedChainId ? "true" : undefined}
                    onClick={() => {
                      setSelectedChainId(item.id);
                      onRouteChange(
                        { mode: "chain", level: chainLevel, id: item.id },
                        "replace",
                      );
                    }}
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
            <MdBlock text={chainBody} empty={chainEmpty} knownNodeIds={knownNodeIds} />
          </article>
        </div>
        </>
      ) : mode === "nodes" ? (
        <div className="browse-layout browse-layout-nodes">
          <div className="browse-sidebar node-graph-sidebar">
            <label className="sr-only" htmlFor="memory-nodes-filter">
              {t("memory.nodes_filter")}
            </label>
            <input
              id="memory-nodes-filter"
              className="browse-filter node-user-filter"
              type="search"
              placeholder={t("memory.nodes_filter")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="node-search-mode" role="group" aria-label={t("memory.nodes_search_mode")}>
              <span className="node-search-mode-label">{t("memory.nodes_search_mode")}:</span>
              <div className="node-search-mode-widget">
                <button
                  type="button"
                  className={`node-search-mode-opt${nodeSearchMode === "title" ? " is-active" : ""}`}
                  aria-pressed={nodeSearchMode === "title"}
                  onClick={() => setNodeSearchMode("title")}
                >
                  {t("memory.nodes_search_title")}
                </button>
                <button
                  type="button"
                  className={`node-search-mode-opt${nodeSearchMode === "title_summary" ? " is-active" : ""}`}
                  aria-pressed={nodeSearchMode === "title_summary"}
                  onClick={() => setNodeSearchMode("title_summary")}
                >
                  {t("memory.nodes_search_title_summary")}
                </button>
              </div>
            </div>
            <div className="node-graph-pane" aria-label={t("memory.mode_nodes")}>
              {indexEmpty ? (
                <p className="browse-empty">{indexEmpty}</p>
              ) : nodes && nodes.length > 0 ? (
                <NodeNetworkGraph
                  nodes={nodes}
                  edges={graphEdges}
                  filter={filter}
                  searchMode={nodeSearchMode}
                  selectedId={selectedNodeId}
                  onSelect={(id) => {
                    setSelectedNodeId(id);
                    onRouteChange({ mode: "nodes", id }, "replace");
                  }}
                />
              ) : (
                <p className="browse-empty">{t("memory.nodes_empty")}</p>
              )}
            </div>
          </div>
          <article className="browse-detail packet-block">
            <h2>{selectedNodeId ?? "—"}</h2>
            {nodeScoreMeta ? <p className="browse-meta">{nodeScoreMeta}</p> : null}
            <MdBlock text={nodeBody} empty={nodeEmpty} knownNodeIds={knownNodeIds} />
          </article>
        </div>
      ) : (
        <div className="browse-layout browse-layout-chain">
          <div
            className="browse-index browse-index-card"
            role="listbox"
            aria-label={t("memory.mode_future")}
          >
            {indexEmpty ? (
              <p className="browse-empty">{indexEmpty}</p>
            ) : (
              <>
                {(futureAnchors ?? []).some((a) => a.zone !== "longTerm") ? (
                  <p className="browse-group-label">{t("memory.future_group_upcoming")}</p>
                ) : null}
                {(futureAnchors ?? [])
                  .filter((a) => a.zone !== "longTerm")
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`browse-item browse-item-chain${item.id === selectedFutureId ? " is-selected" : ""}`}
                      role="option"
                      aria-current={item.id === selectedFutureId ? "true" : undefined}
                      onClick={() => {
                        setSelectedFutureId(item.id);
                        onRouteChange({ mode: "future", id: item.id }, "replace");
                      }}
                    >
                      <span className="browse-item-id">
                        {formatAnchorRange(item.anchor_start, item.anchor_end) || item.id}
                      </span>
                      {item.content ? (
                        <div className="browse-item-preview">{previewContent(item.content)}</div>
                      ) : null}
                    </button>
                  ))}
                {(futureAnchors ?? []).some((a) => a.zone === "longTerm") ? (
                  <p className="browse-group-label">{t("memory.future_group_long_term")}</p>
                ) : null}
                {(futureAnchors ?? [])
                  .filter((a) => a.zone === "longTerm")
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`browse-item browse-item-chain${item.id === selectedFutureId ? " is-selected" : ""}`}
                      role="option"
                      aria-current={item.id === selectedFutureId ? "true" : undefined}
                      onClick={() => {
                        setSelectedFutureId(item.id);
                        onRouteChange({ mode: "future", id: item.id }, "replace");
                      }}
                    >
                      <span className="browse-item-id">
                        {formatAnchorRange(item.anchor_start, item.anchor_end) || item.id}
                      </span>
                      {item.content ? (
                        <div className="browse-item-preview">{previewContent(item.content)}</div>
                      ) : null}
                    </button>
                  ))}
              </>
            )}
          </div>
          <article className="browse-detail packet-block">
            <h2>{selectedFutureId ?? "—"}</h2>
            {futureMeta ? <p className="browse-meta">{futureMeta}</p> : null}
            <MdBlock text={futureBody} empty={futureEmpty} knownNodeIds={knownNodeIds} />
          </article>
        </div>
      )}
    </section>
  );
}
