import { useCallback, useEffect, useState } from "react";
import { engramApi, type DreamReportDetail, type DreamReportListItem } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { MdBlock, RefreshIcon } from "../components/ui";

export function DreamReportsPanel({
  selectedId,
  onSelectedIdChange,
}: {
  selectedId?: string;
  onSelectedIdChange: (id: string | undefined, mode: "push" | "replace") => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<DreamReportListItem[]>([]);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<DreamReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const refresh = useCallback(async () => {
    const { ok, data } = await engramApi.dreams.reports();
    if (!ok) {
      setStatus(data?.message || data?.error || t("events.dream_reports_load"));
      setItems([]);
      return;
    }
    const next = data.items ?? [];
    setItems(next);
    setStatus("");
    if (!selectedId && next[0]) {
      onSelectedIdChange(next[0].dream_run_id, "replace");
    }
  }, [onSelectedIdChange, selectedId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void engramApi.dreams.report(selectedId).then(({ ok, data }) => {
      if (cancelled) return;
      setLoadingDetail(false);
      if (!ok) {
        setDetail({ present: false, message: data?.message || data?.error });
        return;
      }
      setDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="events-dream-reports" role="tabpanel" aria-labelledby="events-tab-dream-reports">
      <div className="panel-head panel-head-tools">
        <button
          type="button"
          className="icon-btn"
          onClick={() => void refresh()}
          data-tooltip={t("activities.refresh")}
          aria-label={t("activities.refresh")}
        >
          <RefreshIcon />
        </button>
      </div>
      {status ? (
        <MdBlock text={status} empty />
      ) : (
        <>
          {items.length === 0 ? (
            <MdBlock text={t("events.dream_reports_empty")} empty />
          ) : (
            <ul className="dream-reports-list" role="listbox" aria-label={t("events.tab_dream_reports")}>
              {items.map((item) => {
                const selected = item.dream_run_id === selectedId;
                const when = item.committed_at || item.created_at;
                return (
                  <li key={item.dream_run_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`dream-reports-item${selected ? " is-selected" : ""}`}
                      onClick={() => onSelectedIdChange(item.dream_run_id, "push")}
                    >
                      <span className="dream-reports-item-time">{when}</span>
                      <span className="dream-reports-item-preview">
                        {item.narrative_preview || t("consolidate.dash")}
                      </span>
                      <span className="dream-reports-item-id">{item.dream_run_id}</span>
                      {item.l1_clear_pending ? (
                        <span className="dream-reports-item-flag">
                          {t("status.dream.l1_clear_pending")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedId || items.length > 0 ? (
            <article className="dream-report-read">
              {loadingDetail ? (
                <MdBlock text={t("activities.loading")} empty />
              ) : !selectedId ? (
                <MdBlock text={t("events.dream_reports_pick")} empty />
              ) : !detail || !detail.present ? (
                <MdBlock text={t("events.dream_reports_missing")} empty />
              ) : (
                <>
                  <header className="dream-report-read-head">
                    <time dateTime={detail.committed_at}>{detail.committed_at}</time>
                    <span className="dream-reports-item-id">{detail.dream_run_id}</span>
                  </header>
                  <MdBlock text={detail.report ?? ""} />
                </>
              )}
            </article>
          ) : null}
        </>
      )}
    </div>
  );
}
