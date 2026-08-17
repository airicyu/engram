/**
 * Convert exact attachment wikilink embeds to markdown images
 * served by GET /attachments/file.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMBED_RE = /!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^\]|]+)\]\]/g;

function isValidFilename(name: string): boolean {
  if (!name || name === "." || name === "..") return false;
  if (name.includes("/") || name.includes("\\")) return false;
  return true;
}

/** Same shape as server `isValidAttachmentPath` (exact four segments). */
export function isValidAttachmentEmbedPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  if (parts[0] !== "_attachments" || parts[1] !== "uploads") return false;
  if (!DAY_RE.test(parts[2]!)) return false;
  return isValidFilename(parts[3]!);
}

function escapeMdAlt(name: string): string {
  return name.replace(/[[\]\\]/g, "");
}

/** `![[_attachments/uploads/{day}/{file}]]` → markdown image via /api/attachments/file. */
export function preprocessAttachmentEmbeds(md: string): string {
  return md.replace(EMBED_RE, (full, path: string) => {
    if (!isValidAttachmentEmbedPath(path)) return full;
    const filename = path.split("/").pop() ?? "image";
    const src = `/api/attachments/file?path=${encodeURIComponent(path)}`;
    return `![${escapeMdAlt(filename)}](${src})`;
  });
}
