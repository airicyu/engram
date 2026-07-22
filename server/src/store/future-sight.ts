import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { homePath } from "./home";
import { appendEvent, nextEventId, taipeiDate, taipeiNowIso } from "./events";
import { appendPoolEntry } from "./l1";

export interface FutureSightAnchor {
  id: string;
  anchor_start: string;
  anchor_end: string;
  content: string;
  node_refs?: string[];
  event_refs?: string[];
  dream_run_id?: string;
  committed_at?: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function futureSightActiveDir(): string {
  return homePath("future-sight", "active");
}

function anchorPath(id: string): string {
  return homePath("future-sight", "active", `${id}.md`);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(s: string): boolean {
  return DAY_RE.test(s);
}

/** Safe id for filesystem (alphanumeric, hyphen, underscore). */
export function isValidFutureSightId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

export function renderFutureSightMarkdown(a: FutureSightAnchor): string {
  const meta: Record<string, unknown> = {
    id: a.id,
    anchor_start: a.anchor_start,
    anchor_end: a.anchor_end,
  };
  if (a.node_refs?.length) meta.node_refs = a.node_refs;
  if (a.event_refs?.length) meta.event_refs = a.event_refs;
  if (a.dream_run_id) meta.dream_run_id = a.dream_run_id;
  if (a.committed_at) meta.committed_at = a.committed_at;

  const body = a.content.trim();
  return `---\n${stringify(meta).trim()}\n---\n\n${body}\n`;
}

export function parseFutureSightMarkdown(text: string, fallbackId?: string): FutureSightAnchor {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    throw new Error("future-sight file missing YAML frontmatter");
  }
  const meta = parse(m[1]) as Record<string, unknown>;
  const id = typeof meta.id === "string" ? meta.id : fallbackId;
  if (!id || !isValidFutureSightId(id)) {
    throw new Error(`invalid future-sight id: ${id}`);
  }
  const anchor_start = String(meta.anchor_start ?? "");
  const anchor_end = String(meta.anchor_end ?? "");
  if (!isValidDay(anchor_start) || !isValidDay(anchor_end)) {
    throw new Error(`invalid anchor dates for ${id}`);
  }
  const node_refs = Array.isArray(meta.node_refs)
    ? meta.node_refs.filter((x): x is string => typeof x === "string")
    : undefined;
  const event_refs = Array.isArray(meta.event_refs)
    ? meta.event_refs.filter((x): x is string => typeof x === "string")
    : undefined;

  return {
    id,
    anchor_start,
    anchor_end,
    content: m[2].trim(),
    node_refs: node_refs?.length ? node_refs : undefined,
    event_refs: event_refs?.length ? event_refs : undefined,
    dream_run_id: typeof meta.dream_run_id === "string" ? meta.dream_run_id : undefined,
    committed_at: typeof meta.committed_at === "string" ? meta.committed_at : undefined,
  };
}

export async function listActiveAnchors(): Promise<FutureSightAnchor[]> {
  const dir = futureSightActiveDir();
  if (!(await exists(dir))) return [];
  const names = await readdir(dir);
  const out: FutureSightAnchor[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const id = name.slice(0, -3);
    try {
      const text = await readFile(anchorPath(id), "utf8");
      out.push(parseFutureSightMarkdown(text, id));
    } catch {
      // skip corrupt
    }
  }
  out.sort((a, b) => a.anchor_start.localeCompare(b.anchor_start) || a.id.localeCompare(b.id));
  return out;
}

export async function countActiveAnchors(): Promise<number> {
  const dir = futureSightActiveDir();
  if (!(await exists(dir))) return 0;
  const names = await readdir(dir);
  return names.filter((n) => n.endsWith(".md")).length;
}

export async function writeActiveAnchor(a: FutureSightAnchor): Promise<void> {
  await mkdir(futureSightActiveDir(), { recursive: true });
  await writeFile(anchorPath(a.id), renderFutureSightMarkdown(a), "utf8");
}

export async function deleteActiveAnchor(id: string): Promise<void> {
  await rm(anchorPath(id), { force: true });
}

export function isExpired(a: FutureSightAnchor, today = taipeiDate()): boolean {
  return a.anchor_end < today;
}

async function expireOne(a: FutureSightAnchor): Promise<void> {
  const event_id = await nextEventId();
  const ts = taipeiNowIso();
  const raw =
    `Future-sight expired: ${a.id} (${a.anchor_start}→${a.anchor_end}). ` +
    `${a.content.trim().slice(0, 400)}`;

  await appendEvent({
    id: event_id,
    ts,
    source: "system/future_sight_expired",
    raw,
    node_refs: a.node_refs,
    ingest_meta: {
      future_sight_id: a.id,
      reason: "past_anchor_end",
      anchor_start: a.anchor_start,
      anchor_end: a.anchor_end,
    },
  });

  await appendPoolEntry({
    id: event_id,
    ts,
    raw,
    node_refs: a.node_refs,
  });

  await deleteActiveAnchor(a.id);
}

/**
 * Lazy sweep: for each active anchor with anchor_end < today,
 * append L0+L1 expiry event then hard-delete the live file.
 */
export async function sweepExpiredFutureSight(today = taipeiDate()): Promise<string[]> {
  const active = await listActiveAnchors();
  const swept: string[] = [];
  for (const a of active) {
    if (!isExpired(a, today)) continue;
    await expireOne(a);
    swept.push(a.id);
  }
  return swept;
}

/** Collect stale future patches (anchor_end < today) for approve gate. */
export function staleFutureAnchorIds(
  patches: Array<{ type: string; id?: string; anchor_end?: string }>,
  today = taipeiDate(),
): string[] {
  const out: string[] = [];
  for (const p of patches) {
    if (p.type === "future" && typeof p.anchor_end === "string" && p.anchor_end < today) {
      if (typeof p.id === "string") out.push(p.id);
    }
  }
  return [...new Set(out)].sort();
}
