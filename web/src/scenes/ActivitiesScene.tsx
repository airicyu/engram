import { useCallback, useEffect, useRef, useState, type FormEvent, type DragEvent } from "react";
import { api, engramApi, type NodeIndex } from "../lib/api";
import { formatL1 } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";
import {
  MentionComposer,
  type MentionComposerHandle,
} from "../components/MentionComposer";

interface AttachmentItem {
  path: string;
  day: string;
  filename: string;
  relationship: string;
}

export function ActivitiesScene() {
  const { t } = useI18n();
  const { status, dreaming, refreshStatus } = useStatus();
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [l1Text, setL1Text] = useState(t("activities.loading"));
  const [l1Empty, setL1Empty] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [nodeIds, setNodeIds] = useState<string[]>([]);

  const composerRef = useRef<MentionComposerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const locked = !!(status?.lock || dreaming);

  const refreshL1 = useCallback(async () => {
    const { ok, data } = await api<{
      present?: boolean;
      summary?: string;
      node_notes?: Record<string, string>;
      message?: string;
      error?: string;
    }>("/memories/short-term-memory");
    if (!ok) {
      setL1Text(data?.message || data?.error || t("empty.l1_load"));
      setL1Empty(true);
      return;
    }
    const { text, empty } = formatL1(data, t);
    setL1Text(text);
    setL1Empty(empty);
  }, [t]);

  const refreshNodes = useCallback(async () => {
    const { ok, data } = await engramApi.memories.nodes.index();
    if (!ok || !data?.nodes) {
      setNodeIds([]);
      return;
    }
    setNodeIds(data.nodes.map((n: NodeIndex) => n.node).filter(Boolean));
  }, []);

  useEffect(() => {
    void refreshL1();
    void refreshNodes();
  }, [refreshL1, refreshNodes]);

  /** Insert text at cursor via composer. */
  function insertAtCursor(text: string) {
    composerRef.current?.insertText(text, { blankLines: true });
  }

  /** Upload a file to tmp and insert embed at cursor. */
  async function uploadFile(file: File) {
    if (locked) return;
    setUploading(true);
    setUploadError("");

    const { ok, status: http, data } = await engramApi.attachments.upload(file);

    if (http === 409 || data?.error === "dream_locked") {
      setUploadError(t("activities.locked"));
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
    if (!locked) setDragOver(true);
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
    if (locked) return;

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
    if (status?.lock) {
      setMsg({ text: t("activities.lock_hint"), kind: "error" });
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
    await Promise.all([refreshStatus(), refreshL1(), refreshNodes()]);
  }

  return (
    <section className="scene is-active" role="tabpanel">
      <p className="scene-lead">{t("activities.lead")}</p>
      <form className="activities-form" onSubmit={onSubmit}>
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
            disabled={locked}
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
        <p className="form-hint">{t("activities.mention_hint")}</p>

        <div className="attachments-section">
          <div className="attachments-header">
            <span className="attachments-title">{t("activities.media_attachments")}</span>
            <button
              type="button"
              className="btn ghost attachment-add-btn"
              disabled={locked}
              onClick={() => fileInputRef.current?.click()}
              title={t("activities.attachment_add")}
            >
              +
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

          {uploading && <p className="form-hint">{t("activities.attachment_uploading")}</p>}
          {uploadError && <p className="form-hint error">{uploadError}</p>}

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
                  rows={2}
                  placeholder={t("activities.attachment_relationship_placeholder")}
                  value={a.relationship}
                  onChange={(e) => updateRelationship(i, e.target.value)}
                  disabled={locked}
                />
              </div>
              <button
                type="button"
                className="btn ghost attachment-remove-btn"
                disabled={locked}
                onClick={() => removeAttachment(i)}
                title={t("activities.attachment_remove")}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={locked}>
            {t("activities.submit")}
          </button>
        </div>
        {locked ? <p className="form-hint">{t("activities.lock_hint")}</p> : null}
        <Msg text={msg.text} kind={msg.kind} />
      </form>
      <div className="l1-panel">
        <div className="panel-head">
          <h2>{t("activities.l1_title")}</h2>
          <button type="button" className="btn ghost" onClick={() => void refreshL1()}>
            {t("activities.refresh")}
          </button>
        </div>
        <MdBlock text={l1Text} empty={l1Empty} />
      </div>
    </section>
  );
}
