/**
 * Activity mention tokens in `raw` (0.32):
 * `[@label](node:id)` ＝ ref；`[@label](node-create:id)` ＝ create intent.
 * Truth lives only in raw — no JSON sidecar.
 */

export type MentionMode = "ref" | "create";

export type Mention = {
  id: string;
  mode: MentionMode;
  label: string;
  /** Start index in raw (inclusive). */
  start: number;
  /** End index in raw (exclusive). */
  end: number;
};

/** Markdown link destinations that count as mentions (no spaces in destination). */
const MENTION_RE = /\[@([^\]]*)\]\((node|node-create):([^)]+)\)/g;

/**
 * Sanitize／validate a mention id per 0.32 contract.
 * Returns trimmed id, or null if invalid.
 */
export function sanitizeMentionId(rawId: string): string | null {
  const id = rawId.trim();
  if (!id || id === "." || id === "..") return null;
  if (/[\s/\x00-\x1f\x7f\\]/.test(id)) return null;
  // ASCII alnum . _ - plus Unicode letters／numbers
  if (!/^[\p{L}\p{N}._-]+$/u.test(id)) return null;
  return id;
}

type ScanHit = {
  label: string;
  kind: "node" | "node-create";
  idRaw: string;
  start: number;
  end: number;
};

function scanHits(raw: string): ScanHit[] {
  if (!raw) return [];
  const out: ScanHit[] = [];
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(raw)) !== null) {
    out.push({
      label: m[1] ?? "",
      kind: m[2] as "node" | "node-create",
      idRaw: m[3]!,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

function hitToMention(hit: ScanHit): Mention | null {
  // Destination id must have no surrounding whitespace (exact node:{id}).
  if (hit.idRaw.trim() !== hit.idRaw) return null;
  const id = sanitizeMentionId(hit.idRaw);
  if (!id) return null;
  return {
    id,
    mode: hit.kind === "node-create" ? "create" : "ref",
    label: hit.label || id,
    start: hit.start,
    end: hit.end,
  };
}

/**
 * Lenient parse for dream／STM／read paths: malformed mention-shaped tokens
 * are ignored (kept as plain text).
 */
export function parseMentions(raw: string): Mention[] {
  const out: Mention[] = [];
  for (const hit of scanHits(raw)) {
    const mention = hitToMention(hit);
    if (mention) out.push(mention);
  }
  return out;
}

/**
 * Strict validation for POST /activities: well-shaped `[@…](node:…)` /
 * `node-create:` tokens must have a valid id, else 400.
 */
export function validateMentionsInRaw(
  raw: string,
): { ok: true; mentions: Mention[] } | { ok: false; error: "invalid_mention_id"; bad_id: string } {
  const mentions: Mention[] = [];
  for (const hit of scanHits(raw)) {
    if (hit.idRaw.trim() !== hit.idRaw) {
      return { ok: false, error: "invalid_mention_id", bad_id: hit.idRaw };
    }
    const id = sanitizeMentionId(hit.idRaw);
    if (!id) {
      return { ok: false, error: "invalid_mention_id", bad_id: hit.idRaw };
    }
    mentions.push({
      id,
      mode: hit.kind === "node-create" ? "create" : "ref",
      label: hit.label || id,
      start: hit.start,
      end: hit.end,
    });
  }
  return { ok: true, mentions };
}

/** Unique node ids referenced (any mode), in first-seen order. */
export function mentionNodeIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of parseMentions(raw)) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    ids.push(m.id);
  }
  return ids;
}

/** Create-intent ids only (deduped, first-seen). */
export function mentionCreateIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of parseMentions(raw)) {
    if (m.mode !== "create") continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    ids.push(m.id);
  }
  return ids;
}

/** Serialize a mention token for UI／tests. */
export function formatMentionToken(id: string, mode: MentionMode, label?: string): string {
  const lbl = (label ?? id).trim() || id;
  const dest = mode === "create" ? `node-create:${id}` : `node:${id}`;
  return `[@${lbl}](${dest})`;
}
