import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { MdBlock } from "../components/ui";

type MemoryMode = "chain" | "nodes";

type DayIndex = { day_id: string; preview?: string };
type NodeIndex = { node: string; preview?: string };

export function MemoryScene() {
  const { t } = useI18n();
  const [mode, setMode] = useState<MemoryMode>("chain");
  const [days, setDays] = useState<DayIndex[] | null>(null);
  const [nodes, setNodes] = useState<NodeIndex[] | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dayMeta, setDayMeta] = useState("");
  const [dayBody, setDayBody] = useState("");
  const [dayEmpty, setDayEmpty] = useState(false);
  const [nodeBody, setNodeBody] = useState("");
  const [nodeEmpty, setNodeEmpty] = useState(false);
  const [filter, setFilter] = useState("");
  const [indexEmpty, setIndexEmpty] = useState("");

  const loadChainDay = useCallback(
    async (dayId: string) => {
      setSelectedDayId(dayId);
      setDayMeta("");
      setDayBody(t("memory.browse_loading"));
      setDayEmpty(false);
      const { ok, data } = await api<{
        present?: boolean;
        source?: string;
        content?: string;
      }>(`/memory/chain/${encodeURIComponent(dayId)}`);
      if (!ok) {
        setDayBody(t("memory.browse_fail"));
        setDayEmpty(true);
        return;
      }
      if (!data.present) {
        setDayBody(t("memory.chain_empty"));
        setDayEmpty(true);
        return;
      }
      const source =
        data.source === "summary"
          ? t("memory.source_summary")
          : data.source === "ledger_fallback"
            ? t("memory.source_ledger")
            : data.source || "";
      setDayMeta(source);
      setDayBody(data.content?.trim() || t("empty.blank"));
      setDayEmpty(!data.content?.trim());
    },
    [t],
  );

  const loadChainIndex = useCallback(async () => {
    setIndexEmpty("");
    setDayBody(t("memory.browse_loading"));
    setDayEmpty(false);
    const { ok, data } = await api<{ present?: boolean; days?: DayIndex[] }>("/memory/chain");
    if (!ok) {
      setDays([]);
      setIndexEmpty(t("memory.browse_fail"));
      setDayBody(t("memory.browse_fail"));
      setDayEmpty(true);
      return;
    }
    if (!data.present || !data.days?.length) {
      setDays([]);
      setIndexEmpty(t("memory.chain_empty"));
      setSelectedDayId(null);
      setDayMeta("");
      setDayBody(t("memory.chain_empty"));
      setDayEmpty(true);
      return;
    }
    setDays(data.days);
    setSelectedDayId((prev) => {
      const next =
        prev && data.days!.some((d) => d.day_id === prev) ? prev : data.days![0].day_id;
      void loadChainDay(next);
      return next;
    });
  }, [t, loadChainDay]);

  const loadNodeDetail = useCallback(
    async (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setNodeBody(t("memory.browse_loading"));
      setNodeEmpty(false);
      const { ok, data } = await api<{ present?: boolean; what_current?: string }>(
        `/memory/nodes/${encodeURIComponent(nodeId)}`,
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
    const { ok, data } = await api<{ present?: boolean; nodes?: NodeIndex[] }>("/memory/nodes");
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
  }, [mode]);

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
        <div className="browse-layout">
          <div className="browse-index" role="listbox" aria-label={t("memory.mode_chain")}>
            {indexEmpty ? (
              <p className="browse-empty">{indexEmpty}</p>
            ) : (
              (days ?? []).map((day) => (
                <button
                  key={day.day_id}
                  type="button"
                  className={`browse-item${day.day_id === selectedDayId ? " is-selected" : ""}`}
                  role="option"
                  aria-current={day.day_id === selectedDayId ? "true" : undefined}
                  onClick={() => void loadChainDay(day.day_id)}
                >
                  <span className="browse-item-id">{day.day_id}</span>
                  {day.preview ? (
                    <div className="browse-item-preview">{day.preview}</div>
                  ) : null}
                </button>
              ))
            )}
          </div>
          <article className="browse-detail packet-block">
            <h2>{selectedDayId ?? "—"}</h2>
            <p className="browse-meta">{dayMeta}</p>
            <MdBlock text={dayBody} empty={dayEmpty} />
          </article>
        </div>
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
