/** Client-side activity mention helpers (0.32). Mirror of server mention contract. */

export type MentionMode = "ref" | "create";

export function sanitizeMentionId(rawId: string): string | null {
  const id = rawId.trim();
  if (!id || id === "." || id === "..") return null;
  if (/[\s/\x00-\x1f\x7f\\]/.test(id)) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(id)) return null;
  return id;
}

export function formatMentionToken(id: string, mode: MentionMode, label?: string): string {
  const lbl = (label ?? id).trim() || id;
  const dest = mode === "create" ? `node-create:${id}` : `node:${id}`;
  return `[@${lbl}](${dest})`;
}

/** Filter live node ids by query (prefix or substring, case-insensitive). */
export function filterNodeIds(ids: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return ids.slice(0, 40);
  return ids.filter((id) => id.toLowerCase().includes(q)).slice(0, 40);
}
