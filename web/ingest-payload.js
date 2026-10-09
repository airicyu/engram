/**
 * Event submit payload. Preview attachments are part of the note even when
 * the compose field lost the wikilink (contenteditable caret outside the editor).
 */
(function (root) {
  function extractEmbedPaths(raw) {
    const re = /!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^|/\]\n]+)\]\]/g;
    const out = [];
    let m;
    while ((m = re.exec(String(raw || "")))) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
    return out;
  }

  function buildIngestPayload(raw, pendingAttach, defaultRel) {
    const relDefault = String(defaultRel || "").trim() || "本則附圖";
    let text = String(raw || "").trim();
    const seen = new Set(extractEmbedPaths(text));
    const extras = [];
    for (const item of pendingAttach || []) {
      const path = item && typeof item.path === "string" ? item.path.trim() : "";
      if (!path || seen.has(path)) continue;
      seen.add(path);
      extras.push(path);
    }
    if (extras.length) {
      const block = extras.map((path) => `![[${path}]]`).join("\n\n");
      text = text ? `${text}\n\n${block}` : block;
    }
    const ordered = extractEmbedPaths(text);
    if (!ordered.length) return { raw: text };
    const attachments = ordered.map((path) => {
      const hit = (pendingAttach || []).find((item) => item && item.path === path);
      const relationship = (hit && String(hit.relationship || "").trim()) || relDefault;
      return { path, relationship };
    });
    return { raw: text, attachments };
  }

  root.extractEmbedPaths = extractEmbedPaths;
  root.buildIngestPayload = buildIngestPayload;
})(globalThis);
