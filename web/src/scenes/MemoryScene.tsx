import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { MdBlock } from "../components/ui";

type MemoryMode = "chain" | "nodes";
type ChainLevel = "day" | "week" | "month" | "year";

type DayIndex = { day_id: string; preview?: string };
type WeekIndex = { week_id: string; preview?: string };
type MonthIndex = { month_id: string; preview?: string };
type YearIndex = { year_id: string; preview?: string };
type NodeIndex = { node: string; preview?: string };

type ChainItem = { id: string; preview?: string };

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
  const [filter, setFilter] = useState("");
  const [indexEmpty, setIndexEmpty] = useState("");

  const loadChainDetail = useCallback(
    async (level: ChainLevel, id: string) => {
      setSelectedChainId(id);
      setChainMeta("");
      setChainBody(t("memory.browse_loading"));
      setChainEmpty(false);
      const path =
        level === "day"
          ? `/memories/chain/${encodeURIComponent(id)}`
          : level === "week"
            ? `/memories/chain/weeks/${encodeURIComponent(id)}`
            : level === "month"
              ? `/memories/chain/months/${encodeURIComponent(id)}`
              : `/memories/chain/years/${encodeURIComponent(id)}`;
      const { ok, data } = await api<{
        present?: boolean;
        source?: string;
        content?: string;
      }>(path);
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
      if (level === "day") {
        const source =
          data.source === "summary"
            ? t("memory.source_summary")
            : data.source === "ledger_fallback"
              ? t("memory.source_ledger")
              : data.source || "";
        setChainMeta(source);
      } else {
        setChainMeta(t("memory.source_summary"));
      }
      setChainBody(data.content?.trim() || t("empty.blank"));
      setChainEmpty(!data.content?.trim());
    },
    [t],
  );

  const loadChainIndex = useCallback(async () => {
    setIndexEmpty("");
    setChainBody(t("memory.browse_loading"));
    setChainEmpty(false);
    const level = chainLevel;
    let items: ChainItem[] = [];
    let present = false;

    if (level === "day") {
      const { ok, data } = await api<{ present?: boolean; days?: DayIndex[] }>("/memories/chain");
      if (!ok) {
        setChainItems([]);
        setIndexEmpty(t("memory.browse_fail"));
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
        return;
      }
      present = !!data.present;
      items = (data.days ?? []).map((d) => ({ id: d.day_id, preview: d.preview }));
    } else if (level === "week") {
      const { ok, data } = await api<{ present?: boolean; weeks?: WeekIndex[] }>(
        "/memories/chain/weeks",
      );
      if (!ok) {
        setChainItems([]);
        setIndexEmpty(t("memory.browse_fail"));
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
        return;
      }
      present = !!data.present;
      items = (data.weeks ?? []).map((d) => ({ id: d.week_id, preview: d.preview }));
    } else if (level === "month") {
      const { ok, data } = await api<{ present?: boolean; months?: MonthIndex[] }>(
        "/memories/chain/months",
      );
      if (!ok) {
        setChainItems([]);
        setIndexEmpty(t("memory.browse_fail"));
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
        return;
      }
      present = !!data.present;
      items = (data.months ?? []).map((d) => ({ id: d.month_id, preview: d.preview }));
    } else {
      const { ok, data } = await api<{ present?: boolean; years?: YearIndex[] }>(
        "/memories/chain/years",
      );
      if (!ok) {
        setChainItems([]);
        setIndexEmpty(t("memory.browse_fail"));
        setChainBody(t("memory.browse_fail"));
        setChainEmpty(true);
        return;
      }
      present = !!data.present;
      items = (data.years ?? []).map((d) => ({ id: d.year_id, preview: d.preview }));
    }

    if (!present || !items.length) {
      setChainItems([]);
      setIndexEmpty(t("memory.chain_empty"));
      setSelectedChainId(null);
      setChainMeta("");
      setChainBody(t("memory.chain_empty"));
      setChainEmpty(true);
      return;
    }
    setChainItems(items);
    setSelectedChainId((prev) => {
      const next = prev && items.some((d) => d.id === prev) ? prev : items[0]!.id;
      void loadChainDetail(level, next);
      return next;
    });
  }, [t, chainLevel, loadChainDetail]);

  const loadNodeDetail = useCallback(
    async (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setNodeBody(t("memory.browse_loading"));
      setNodeEmpty(false);
      const { ok, data } = await api<{ present?: boolean; what_current?: string }>(
        `/memories/nodes/${encodeURIComponent(nodeId)}`,
      );
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
      setNodeBody(data.what_current?.trim() || t("empty.no_what"));
      setNodeEmpty(!data.what_current?.trim());
    },
    [t],
  );

  const loadNodesIndex = useCallback(async () => {
    setIndexEmpty("");
    setNodeBody(t("memory.browse_loading"));
    setNodeEmpty(false);
    const { ok, data } = await api<{ present?: boolean; nodes?: NodeIndex[] }>("/memories/nodes");
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
      setSelectedNodeId(null);
      setNodeBody(t("memory.nodes_empty"));
      setNodeEmpty(true);
      return;
    }
    setNodes(data.nodes);
  }, [t]);

  useEffect(() => {
    if (mode === "chain") void loadChainIndex();
    else void loadNodesIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chainLevel]);

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
    if (next) void loadNodeDetail(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, nodes, filter]);

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
                onClick={() => setChainLevel(level)}
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
                    onClick={() => void loadChainDetail(chainLevel, item.id)}
                  >
                    <span className="browse-item-id">{item.id}</span>
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
                    onClick={() => void loadNodeDetail(n.node)}
                  >
                    <span className="browse-item-id">{n.node}</span>
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
            <MdBlock text={nodeBody} empty={nodeEmpty} />
          </article>
        </div>
      )}
    </section>
  );
}
