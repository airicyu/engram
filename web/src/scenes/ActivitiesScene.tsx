import { useCallback, useEffect, useRef, useState, type FormEvent, type DragEvent } from "react";
import { api, engramApi, type ClarifyPendingItem, type NodeIndex } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg, RefreshIcon } from "../components/ui";
import {
  MentionComposer,
  type MentionComposerHandle,
} from "../components/MentionComposer";
import { ConsolidateScene } from "./ConsolidateScene";

export type EventsFeed = "recent" | "consolidate";

function EventsTabIcon({ feed }: { feed: EventsFeed }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "events-tab-icon",
  };
  if (feed === "recent") {
    return (
      <svg {...common}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <circle cx="4.2" cy="6" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="4.2" cy="12" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="4.2" cy="18" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14.5 4.2A7.2 7.2 0 1 0 19.8 14 5.6 5.6 0 0 1 14.5 4.2Z" />
    </svg>
  );
}

interface AttachmentItem {
  path: string;
  day: string;
  filename: string;
  relationship: string;
}

function MediaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="8.5" cy="10" r="1.25" />
      <path d="m21 15.5-4.2-4.2a1.2 1.2 0 0 0-1.7 0L8 18.5" />
    </svg>
  );
}

export function ActivitiesScene({
  feed,
  onFeedChange,
}: {
  feed: EventsFeed;
  onFeedChange: (feed: EventsFeed) => void;
}) {
  const { t } = useI18n();
  const { refreshStatus } = useStatus();
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [l1Entries, setL1Entries] = useState<Array<{ id: string; ts: string; raw: string }>>([]);
  const [l1Empty, setL1Empty] = useState(false);
  const [l1Status, setL1Status] = useState(t("activities.loading"));
  const [pendingItems, setPendingItems] = useState<ClarifyPendingItem[]>([]);
  const [pendingStatus, setPendingStatus] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [nodeIds, setNodeIds] = useState<string[]>([]);

  const composerRef = useRef<MentionComposerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const refreshL1 = useCallback(async () => {
    const { ok, data } = await api<{
      present?: boolean;
      entries?: Array<{ id: string; ts: string; raw: string }>;
      message?: string;
      error?: string;
    }>("/memories/short-term-memory");
    if (!ok) {
      setL1Status(data?.message || data?.error || t("empty.l1_load"));
      setL1Entries([]);
      setL1Empty(true);
      return;
    }
    const entries = data.entries ?? [];
    setL1Entries([...entries].reverse());
    setL1Empty(!data.present || entries.length === 0);
    setL1Status(data.present ? "" : t("activities.recent_events_empty"));
  }, [t]);

  const refreshPending = useCallback(async () => {
    const { ok, data } = await engramApi.memories.clarify.listPending();
    if (!ok) {
      setPendingStatus(data?.message || data?.error || t("activities.pending_clarify_load"));
      return;
    }
    setPendingItems(data.items ?? []);
    setPendingStatus("");
  }, [t]);

  const refreshRecent = useCallback(async () => {
    await Promise.all([refreshL1(), refreshPending()]);
  }, [refreshL1, refreshPending]);

  const refreshNodes = useCallback(async () => {
    const { ok, data } = await engramApi.memories.nodes.index();
    if (!ok || !data?.nodes) {
      setNodeIds([]);
      return;
    }
    setNodeIds(data.nodes.map((n: NodeIndex) => n.node).filter(Boolean));
  }, []);

  useEffect(() => {
    void refreshNodes();
  }, [refreshNodes]);

  useEffect(() => {
    if (feed === "recent") {
      void refreshRecent();
      return;
    }
    void refreshStatus();
  }, [feed, refreshRecent, refreshStatus]);

  /** Insert text at cursor via composer. */
  function insertAtCursor(text: string) {
    composerRef.current?.insertText(text, { blankLines: true });
  }

  /** Upload a file to tmp and insert embed at cursor. */
  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError("");

    const { ok, status: http, data } = await engramApi.attachments.upload(file);

    if (http === 409 || data?.error === "dream_locked") {
      setUploadError(data?.message || t("activities.locked"));
      setUploading(false);
      await refreshStatus();
      return;
    }

    if (!ok || !data.path || !data.day || !data.filename) {
      setUploadError(data?.message || data?.error || t("activities.attachment_upload_fail"));
      setUploading(false);
      return;
    }

    const embed = `![[${data.path}]]`;
    insertAtCursor(embed);

    setAttachments((prev) => [
      ...prev,
      { path: data.path!, day: data.day!, filename: data.filename!, relationship: "" },
    ]);

    setUploading(false);
  }

  async function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of files) {
      await uploadFile(file);
    }
    e.target.value = "";
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        await uploadFile(file);
      }
    }
  }

  async function removeAttachment(index: number) {
    const item = attachments[index];
    if (!item) return;

    const embedPattern = `![[${item.path}]]`;
    const current = composerRef.current?.getSerialized() ?? raw;
    const newRaw = current.replace(embedPattern, "").replace(/\n{3,}/g, "\n\n").trim();
    composerRef.current?.setSerialized(newRaw ? `${newRaw}\n` : "");
    setRaw(newRaw ? `${newRaw}\n` : "");

    await engramApi.attachments.deleteTmp(item.day, item.filename).catch(() => {});
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRelationship(index: number, value: string) {
    setAttachments((prev) => prev.map((a, i) => (i === index ? { ...a, relationship: value } : a)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = (composerRef.current?.getSerialized() ?? raw).trim();
    if (!trimmed) {
      setMsg({ text: t("activities.empty_input"), kind: "error" });
      return;
    }

    for (const a of attachments) {
      if (!a.relationship.trim()) {
        setMsg({ text: t("activities.attachment_empty_relationship"), kind: "error" });
        return;
      }
    }

    const body: Record<string, unknown> = { raw: trimmed, source: "web" };
    if (attachments.length > 0) {
      body.attachments = attachments.map((a) => ({
        path: a.path,
        relationship: a.relationship.trim(),
      }));
    }

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
    composerRef.current?.clear();
    setRaw("");
    setAttachments([]);
    await Promise.all([refreshStatus(), refreshRecent(), refreshNodes()]);
  }

  return (
    <section className="scene is-active" aria-label={t("nav.events")}>
      <p className="scene-lead">{t("activities.lead")}</p>
      <form className="activities-form compose-card" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="activities-raw">
          {t("activities.label_raw")}
        </label>
        <div
          ref={dropZoneRef}
          className={`activities-textarea-wrapper${dragOver ? " drag-over" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <MentionComposer
            ref={composerRef}
            id="activities-raw"
            placeholder={t("activities.placeholder")}
            nodeIds={nodeIds}
            onChange={setRaw}
            onPasteImage={(file) => void uploadFile(file)}
            labels={{
              create: t("activities.mention_create"),
              createExists: t("activities.mention_create_exists"),
              emptyCreate: t("activities.mention_empty"),
            }}
          />
          {dragOver && (
            <div className="drop-overlay">{t("activities.attachment_drop_hint")}</div>
          )}
        </div>

        {uploading ? <p className="form-hint">{t("activities.attachment_uploading")}</p> : null}
        {uploadError ? <p className="form-hint error">{uploadError}</p> : null}

        {attachments.length > 0 ? (
          <div className="attachments-list">
            {attachments.map((a, i) => (
              <div key={`${a.path}-${i}`} className="attachment-item">
                <div className="attachment-preview">
                  <img
                    src={`/api/attachments/file?path=${encodeURIComponent(a.path)}`}
                    alt={a.filename}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="attachment-meta">
                  <code className="attachment-path">{a.path}</code>
                  <label className="sr-only" htmlFor={`attachment-rel-${i}`}>
                    {t("activities.attachment_relationship_label")}
                  </label>
                  <textarea
                    id={`attachment-rel-${i}`}
                    className="attachment-relationship"
                    rows={1}
                    placeholder={t("activities.attachment_relationship_placeholder")}
                    value={a.relationship}
                    onChange={(e) => updateRelationship(i, e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn ghost attachment-remove-btn"
                  onClick={() => removeAttachment(i)}
                  title={t("activities.attachment_remove")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="compose-toolbar">
          <div className="compose-toolbar-tools">
            <button
              type="button"
              className="compose-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              data-tooltip={t("activities.attachment_add")}
              aria-label={t("activities.attachment_add")}
            >
              <MediaIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={onFileInputChange}
              multiple
            />
          </div>
          <button type="submit" className="btn primary compose-post-btn">
            {t("activities.submit")}
          </button>
        </div>
        <Msg text={msg.text} kind={msg.kind} />
      </form>

      <div className="events-col">
      <div className="events-tabs" role="tablist" aria-label={t("nav.events")}>
        <button
          type="button"
          role="tab"
          id="events-tab-recent"
          className={`events-tab${feed === "recent" ? " is-active" : ""}`}
          aria-selected={feed === "recent"}
          onClick={() => onFeedChange("recent")}
        >
          <EventsTabIcon feed="recent" />
          {t("events.tab_recent")}
        </button>
        <button
          type="button"
          role="tab"
          className={`events-tab${feed === "consolidate" ? " is-active" : ""}`}
          aria-selected={feed === "consolidate"}
          onClick={() => onFeedChange("consolidate")}
        >
          <EventsTabIcon feed="consolidate" />
          {t("events.tab_consolidate")}
        </button>
      </div>

      {feed === "recent" ? (
        <div className="l1-panel" role="tabpanel" aria-labelledby="events-tab-recent">
          <div className="panel-head panel-head-tools">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void refreshRecent()}
              data-tooltip={t("activities.refresh")}
              aria-label={t("activities.refresh")}
            >
              <RefreshIcon />
            </button>
          </div>
          <section className="recent-section" aria-labelledby="recent-events-heading">
            <h2 id="recent-events-heading" className="recent-section-title">
              {t("activities.recent_events_heading")}
            </h2>
            {l1Empty ? (
              <MdBlock text={l1Status || t("activities.recent_events_empty")} empty />
            ) : (
              <div className="stm-feed">
                {l1Entries.map((e) => (
                  <article key={e.id} className="stm-entry">
                    <header className="stm-entry-meta">
                      <time dateTime={e.ts}>{e.ts}</time>
                      <span className="stm-entry-id">{e.id}</span>
                    </header>
                    <MdBlock text={e.raw} />
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="recent-section" aria-labelledby="recent-pending-heading">
            <h2 id="recent-pending-heading" className="recent-section-title">
              {t("activities.pending_clarify_heading")}
            </h2>
            {pendingStatus ? (
              <MdBlock text={pendingStatus} empty />
            ) : pendingItems.length === 0 ? (
              <MdBlock text={t("activities.pending_clarify_empty")} empty />
            ) : (
              <div className="stm-feed">
                {pendingItems.map((item) => (
                  <article key={item.id} className="stm-entry">
                    <header className="stm-entry-meta">
                      <time dateTime={item.answered_at}>{item.answered_at}</time>
                      <span className="stm-entry-id">{item.id}</span>
                      {item.kind === "aside" ? (
                        <span className="stm-entry-kind">{t("activities.pending_aside_label")}</span>
                      ) : item.kind !== "prompt" ? (
                        <span className="stm-entry-kind">{t("scene.clarify")}</span>
                      ) : null}
                    </header>
                    {item.kind === "prompt" && item.question ? (
                      <div className="clarify-pending-question">
                        <MdBlock text={item.question} />
                      </div>
                    ) : null}
                    <MdBlock text={item.answer} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="events-consolidate" role="tabpanel">
          <ConsolidateScene />
        </div>
      )}
      </div>
    </section>
  );
}
