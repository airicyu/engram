/**
 * Vault attachment embeds: Obsidian / Engram canonical wikilink form.
 * HTTP markdown image URLs are UI/runtime only; normalize on import & before persist.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WIKI_EMBED_RE = /!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^\]|]+)\]\]/g;

/** Markdown image whose href is GET /attachments/file?path=… (optional /api prefix). */
const MD_IMG_FILE_RE =
  /!\[([^\]]*)\]\(\s*(?:\/api)?\/attachments\/file\?path=([^)\s]+)\s*\)/gi;

function isValidFilename(name: string): boolean {
  if (!name || name === "." || name === "..") return false;
  if (name.includes("/") || name.includes("\\")) return false;
  return true;
}

export function isValidAttachmentEmbedPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  if (parts[0] !== "_attachments" || parts[1] !== "uploads") return false;
  if (!DAY_RE.test(parts[2]!)) return false;
  return isValidFilename(parts[3]!);
}

function decodePathParam(raw: string): string | null {
  try {
    const path = decodeURIComponent(raw.trim());
    return isValidAttachmentEmbedPath(path) ? path : null;
  } catch {
    return null;
  }
}

/** Replace baked HTTP image markdown with `![[_attachments/uploads/…]]`. */
export function normalizeAttachmentEmbedsInMarkdown(md: string): string {
  let out = String(md ?? "");
  out = out.replace(MD_IMG_FILE_RE, (full, _alt, pathParam) => {
    const path = decodePathParam(pathParam);
    if (!path) return full;
    return `![[${path}]]`;
  });
  return out;
}

/** Extract valid wikilink embed paths from markdown. */
export function listWikilinkEmbedPaths(md: string): string[] {
  const found: string[] = [];
  const re = new RegExp(WIKI_EMBED_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(md ?? "")))) {
    const p = m[1];
    if (p && isValidAttachmentEmbedPath(p)) found.push(p);
  }
  return found;
}
