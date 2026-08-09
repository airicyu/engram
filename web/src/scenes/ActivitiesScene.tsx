import { useCallback, useEffect, useRef, useState, type FormEvent, type DragEvent, type ClipboardEvent } from "react";
import { api, engramApi } from "../lib/api";
import { formatL1, parseNodeRefs } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { MdBlock, Msg } from "../components/ui";

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
  const [refs, setRefs] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" as "" | "error" | "ok" });
  const [l1Text, setL1Text] = useState(t("activities.loading"));
  const [l1Empty, setL1Empty] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    void refreshL1();
  }, [refreshL1]);

  /** Insert text at cursor position in textarea, with blank lines before/after. */
  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = raw.slice(0, start);
    const after = raw.slice(end);

    // Ensure blank lines before and after
    let prefix = "";
    let suffix = "";
    if (before.length > 0 && !before.endsWith("\n\n") && !before.endsWith("\n")) {
      prefix = "\n\n";
    } else if (before.length > 0 && !before.endsWith("\n\n")) {
      prefix = "\n";
    }
    if (after.length > 0 && !after.startsWith("\n\n") && !after.startsWith("\n")) {
      suffix = "\n\n";
    } else if (after.length > 0 && !after.startsWith("\n\n")) {
      suffix = "\n";
    }

    const newRaw = before + prefix + text + suffix + after;
    setRaw(newRaw);

    // Restore cursor position after the inserted text
    setTimeout(() => {
      const newPos = start + prefix.length + text.length;
      ta.selectionStart = newPos;
      ta.selectionEnd = newPos;
      ta.focus();
    }, 0);
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

  /** Handle file input change (paperclip/+ button). */
  async function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of files) {
      await uploadFile(file);
    }
    // Reset so the same file can be picked again
    e.target.value = "";
  }

  /** Handle drag events. */
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

  /** Handle paste events for clipboard images. */
  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadFile(file);
        }
      }
    }
  }

  /** Remove an attachment: delete tmp file + remove from state + remove embed from textarea. */
  async function removeAttachment(index: number) {
    const item = attachments[index];
    if (!item) return;

    // Remove embed from raw text
    const embedPattern = `![[${item.path}]]`;
    const newRaw = raw.replace(embedPattern, "").replace(/\n{3,}/g, "\n\n").trim();
    setRaw(newRaw ? newRaw + "\n" : "");

    // Delete tmp file (best-effort)
    await engramApi.attachments.deleteTmp(item.day, item.filename).catch(() => {});

    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  /** Update relationship for an attachment. */
  function updateRelationship(index: number, value: string) {
    setAttachments((prev) => prev.map((a, i) => (i === index ? { ...a, relationship: value } : a)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = raw.trim();
    if (!trimmed) {
      setMsg({ text: t("activities.empty_input"), kind: "error" });
      return;
    }
    if (status?.lock) {
      setMsg({ text: t("activities.lock_hint"), kind: "error" });
      return;
    }

    // Validate relationships are filled
    for (const a of attachments) {
      if (!a.relationship.trim()) {
        setMsg({ text: t("activities.attachment_empty_relationship"), kind: "error" });
        return;
      }
    }

    const body: Record<string, unknown> = { raw: trimmed, source: "web" };
    const nodeRefs = parseNodeRefs(refs);
    if (nodeRefs.length) body.node_refs = nodeRefs;

    if (attachments.length > 0) {
      body.attachments = attachments.map((a) => ({ path: a.path, relationship: a.relationship.trim() }));
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
    setRaw("");
    setRefs("");
    setAttachments([]);
    await Promise.all([refreshStatus(), refreshL1()]);
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
          <textarea
            id="activities-raw"
            ref={textareaRef}
            rows={8}
            placeholder={t("activities.placeholder")}
            required
            disabled={locked}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={onPaste}
          />
          {dragOver && (
            <div className="drop-overlay">{t("activities.attachment_drop_hint")}</div>
          )}
        </div>

        <div className="form-row">
          <label className="field-inline">
            <span>{t("activities.node_refs")}</span>
            <input
              type="text"
              placeholder={t("activities.refs_placeholder")}
              autoComplete="off"
              disabled={locked}
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
            />
          </label>
        </div>

        {/* Media attachments section */}
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

          {uploading && (
            <p className="form-hint">{t("activities.attachment_uploading")}</p>
          )}
          {uploadError && (
            <p className="form-hint error">{uploadError}</p>
          )}

          {attachments.map((a, i) => (
            <div key={`${a.path}-${i}`} className="attachment-item">
              <div className="attachment-preview">
                <img
                  src={`/api/attachments/file?path=${encodeURIComponent(a.path)}`}
                  alt={a.filename}
                  onError={(e) => {
                    // Fallback: show filename if image can't load
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