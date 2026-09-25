/**
 * Activity create-intent mentions in pool `raw` (0.6.1).
 * `[@label](node-create:id)` = must seed node on distill.
 * Ref mentions stay as Obsidian wikilinks `[[nodes/{id}/{id}|title]]` (not this module).
 */

export type CreateMention = {
  id: string;
  label: string;
  start: number;
  end: number;
};

const CREATE_RE = /\[@([^\]]*)\]\(node-create:([^)]+)\)/g;

/** Sanitize／validate a mention id (Engram 0.32 aligned). */
export function sanitizeMentionId(rawId: string): string | null {
  const id = rawId.trim();
  if (!id || id === "." || id === "..") return null;
  if (/[\s/\x00-\x1f\x7f\\]/.test(id)) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(id)) return null;
  return id;
}

export function formatCreateMentionToken(id: string, label?: string): string {
  const lbl = (label ?? id).trim() || id;
  return `[@${lbl}](node-create:${id})`;
}

type ScanHit = { label: string; idRaw: string; start: number; end: number };

function scanCreateHits(raw: string): ScanHit[] {
  if (!raw) return [];
  const out: ScanHit[] = [];
  CREATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CREATE_RE.exec(raw)) !== null) {
    out.push({
      label: m[1] ?? "",
      idRaw: m[2]!,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/** Lenient parse: malformed create-shaped tokens ignored. */
export function parseCreateMentions(raw: string): CreateMention[] {
  const out: CreateMention[] = [];
  for (const hit of scanCreateHits(raw)) {
    if (hit.idRaw.trim() !== hit.idRaw) continue;
    const id = sanitizeMentionId(hit.idRaw);
    if (!id) continue;
    out.push({ id, label: hit.label || id, start: hit.start, end: hit.end });
  }
  return out;
}

/** Create-intent ids only (deduped, first-seen). */
export function mentionCreateIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of parseCreateMentions(raw)) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    ids.push(m.id);
  }
  return ids;
}

export type MentionValidateOk = { ok: true; createIds: string[] };
export type MentionValidateErr =
  | { ok: false; error: "invalid_mention_id"; bad_id: string }
  | { ok: false; error: "mention_create_exists"; id: string };

/**
 * Strict validation for POST /events.
 * Well-shaped create tokens must have valid ids; create id must not already exist live.
 */
export function validateCreateMentionsInRaw(
  raw: string,
  liveNodeIds: Iterable<string>,
): MentionValidateOk | MentionValidateErr {
  const live = liveNodeIds instanceof Set ? liveNodeIds : new Set(liveNodeIds);
  const createIds: string[] = [];
  const seen = new Set<string>();

  for (const hit of scanCreateHits(raw)) {
    if (hit.idRaw.trim() !== hit.idRaw) {
      return { ok: false, error: "invalid_mention_id", bad_id: hit.idRaw };
    }
    const id = sanitizeMentionId(hit.idRaw);
    if (!id) {
      return { ok: false, error: "invalid_mention_id", bad_id: hit.idRaw };
    }
    if (live.has(id)) {
      return { ok: false, error: "mention_create_exists", id };
    }
    if (!seen.has(id)) {
      seen.add(id);
      createIds.push(id);
    }
  }
  return { ok: true, createIds };
}
