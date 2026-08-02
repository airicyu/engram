/** Future-sight dual-zone store (hot.md / later.md), parse/render, and calendar maintenance. */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "../../yaml";
import { config } from "../../config";
import { homePath } from "../home";
import { stageAndCommitPaths } from "../git";
import { captureActivity } from "./capture";
import { calendarDate, nowIso } from "./activities";

/** A near-horizon anchor stored outside the memory chain. */
export interface FutureSightAnchor {
  id: string;
  anchor_start: string;
  anchor_end: string;
  content: string;
}

/** Zone for an anchor in the dual-file layout. */
export type FutureSightZone = "hot" | "later";

/** Anchor plus which file it currently lives in. */
export interface FutureSightListedAnchor extends FutureSightAnchor {
  zone: FutureSightZone;
}

export type MaintainMode = "full" | "expire_only";
export type MaintainTarget = "live" | "draft";

export interface MaintainFutureSightOpts {
  mode: MaintainMode;
  /** Default live under ENGRAM_STORE_DIR. Draft needs baseDir = draft root. */
  target?: MaintainTarget;
  /** Absolute path to draft run root when target=draft. */
  baseDir?: string;
  today?: string;
  /** When true and target=live, commit changed tracked paths. */
  commit?: boolean;
  windowDays?: number;
  hotDays?: number;
}

export interface MaintainFutureSightResult {
  expired: string[];
  out_of_window: string[];
  /** Expired ids still present after draft maintain (approve → 409). */
  stale_expired: string[];
  changed: boolean;
  committed: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Return whether a value is a YYYY-MM-DD day identifier. */
export function isValidDay(s: string): boolean {
  return DAY_RE.test(s);
}

/** Safe id for filesystem (alphanumeric, hyphen, underscore). */
export function isValidFutureSightId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

/** Add `n` calendar days to a YYYY-MM-DD (UTC date arithmetic; labels only). */
export function addCalendarDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Resolve future-sight directory (live store). */
export function futureSightDir(): string {
  return homePath("memories", "future-sight");
}

export function futureSightZoneRel(zone: FutureSightZone): string {
  return `memories/future-sight/${zone}.md`;
}

function zoneFileName(zone: FutureSightZone): string {
  return `${zone}.md`;
}

function liveZonePath(zone: FutureSightZone): string {
  return homePath("memories", "future-sight", zoneFileName(zone));
}

function zonePath(zone: FutureSightZone, baseDir?: string): string {
  if (baseDir) return join(baseDir, "memories", "future-sight", zoneFileName(zone));
  return liveZonePath(zone);
}

/** Empty skeleton for a zone file. */
export function emptyZoneMarkdown(zone: FutureSightZone, updatedAt = nowIso()): string {
  return `---\n${stringify({ zone, updated_at: updatedAt }).trim()}\n---\n`;
}

/** Ensure live hot.md / later.md exist. */
export async function ensureFutureSightFiles(): Promise<void> {
  await mkdir(futureSightDir(), { recursive: true });
  for (const zone of ["hot", "later"] as const) {
    const path = liveZonePath(zone);
    if (!(await exists(path))) {
      await writeFile(path, emptyZoneMarkdown(zone), "utf8");
    }
  }
}

function parseItemFields(meta: Record<string, unknown>, id: string): FutureSightAnchor {
  if (!isValidFutureSightId(id)) {
    throw new Error(`invalid future-sight id: ${id}`);
  }
  const anchor_start = String(meta.anchor_start ?? "");
  const anchor_end = String(meta.anchor_end ?? "");
  if (!isValidDay(anchor_start) || !isValidDay(anchor_end)) {
    throw new Error(`invalid anchor dates for ${id}`);
  }
  if (anchor_start > anchor_end) {
    throw new Error(`anchor_start > anchor_end for ${id}`);
  }

  return {
    id,
    anchor_start,
    anchor_end,
    content: "",
  };
}

/**
 * Parse a 0.17 zone file (`## id` + yaml fence + body).
 * Returns anchors in file order (caller may re-sort).
 */
export function parseZoneFile(text: string, expectedZone?: FutureSightZone): FutureSightAnchor[] {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) {
    throw new Error("future-sight zone file missing YAML frontmatter");
  }
  const fileMeta = parse(fm[1]) as Record<string, unknown>;
  if (expectedZone && fileMeta.zone !== expectedZone) {
    throw new Error(`zone frontmatter mismatch: expected ${expectedZone}, got ${fileMeta.zone}`);
  }

  const body = fm[2] ?? "";
  const anchors: FutureSightAnchor[] = [];
  const headingRe = /^##\s+(\S+)\s*$/gm;
  const matches = [...body.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const id = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const chunk = body.slice(start, end).trim();
    const fence = chunk.match(/^```yaml\n([\s\S]*?)\n```\n?([\s\S]*)$/);
    if (!fence) {
      throw new Error(`future-sight item ${id}: missing yaml fence`);
    }
    const meta = parse(fence[1]) as Record<string, unknown>;
    if (meta.id != null && meta.id !== id) {
      throw new Error(`future-sight item ${id}: fence id mismatch`);
    }
    const a = parseItemFields(meta, id);
    a.content = fence[2].trim();
    anchors.push(a);
  }
  return anchors;
}

/** Sort anchors near→far (write contract). */
export function sortAnchors(anchors: FutureSightAnchor[]): FutureSightAnchor[] {
  return [...anchors].sort(
    (a, b) =>
      a.anchor_start.localeCompare(b.anchor_start) ||
      a.anchor_end.localeCompare(b.anchor_end) ||
      a.id.localeCompare(b.id),
  );
}

function renderItem(a: FutureSightAnchor): string {
  const meta: Record<string, unknown> = {
    anchor_start: a.anchor_start,
    anchor_end: a.anchor_end,
  };
  const body = a.content.trim();
  return `## ${a.id}\n\`\`\`yaml\n${stringify(meta).trim()}\n\`\`\`\n\n${body}\n`;
}

/** Render a full zone file. */
export function renderZoneFile(
  zone: FutureSightZone,
  anchors: FutureSightAnchor[],
  updatedAt = nowIso(),
): string {
  const sorted = sortAnchors(anchors);
  const fm = stringify({ zone, updated_at: updatedAt }).trim();
  if (sorted.length === 0) {
    return `---\n${fm}\n---\n`;
  }
  return `---\n${fm}\n---\n\n${sorted.map(renderItem).join("\n")}`;
}

/**
 * Legacy 0.16 single-file frontmatter parse (migrate + typed future patch helpers).
 */
export function parseLegacyActiveMarkdown(text: string, fallbackId?: string): FutureSightAnchor {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    throw new Error("future-sight file missing YAML frontmatter");
  }
  const meta = parse(m[1]) as Record<string, unknown>;
  const id = typeof meta.id === "string" ? meta.id : fallbackId;
  if (!id || !isValidFutureSightId(id)) {
    throw new Error(`invalid future-sight id: ${id}`);
  }
  const a = parseItemFields(meta, id);
  a.content = m[2].trim();
  return a;
}

/** @deprecated Alias — prefer parseLegacyActiveMarkdown or parseZoneFile. */
export function parseFutureSightMarkdown(text: string, fallbackId?: string): FutureSightAnchor {
  // Zone files start with zone: in frontmatter and ## headings in body.
  if (/^---\n[\s\S]*?\nzone:\s*(hot|later)\b/m.test(text) && /^##\s+\S+/m.test(text)) {
    const zone = text.match(/^zone:\s*(hot|later)\s*$/m)?.[1] as FutureSightZone | undefined;
    const list = parseZoneFile(text, zone);
    if (fallbackId) {
      const found = list.find((a) => a.id === fallbackId);
      if (found) return found;
    }
    if (list.length === 1) return list[0];
    throw new Error("parseFutureSightMarkdown: ambiguous zone file");
  }
  return parseLegacyActiveMarkdown(text, fallbackId);
}

/**
 * Render a single anchor as legacy active file (migrate input／typed patch only).
 * Prefer renderZoneFile for live store. Only id＋dates＋content.
 */
export function renderFutureSightMarkdown(a: FutureSightAnchor): string {
  const meta: Record<string, unknown> = {
    id: a.id,
    anchor_start: a.anchor_start,
    anchor_end: a.anchor_end,
  };
  const body = a.content.trim();
  return `---\n${stringify(meta).trim()}\n---\n\n${body}\n`;
}

/** True if zone markdown still carries dropped provenance keys (needs rewrite). */
export function zoneFileHasDroppedKeys(text: string): boolean {
  return /```yaml\n[\s\S]*?\b(node_refs|event_refs|dream_run_id|committed_at)\s*:/.test(text);
}

async function readZoneAnchors(
  zone: FutureSightZone,
  baseDir?: string,
): Promise<FutureSightAnchor[]> {
  const path = zonePath(zone, baseDir);
  if (!(await exists(path))) return [];
  const text = await readFile(path, "utf8");
  if (!text.trim()) return [];
  try {
    return parseZoneFile(text, zone);
  } catch {
    return [];
  }
}

async function writeZoneAnchors(
  zone: FutureSightZone,
  anchors: FutureSightAnchor[],
  baseDir?: string,
): Promise<void> {
  const dir = baseDir
    ? join(baseDir, "memories", "future-sight")
    : futureSightDir();
  await mkdir(dir, { recursive: true });
  await writeFile(zonePath(zone, baseDir), renderZoneFile(zone, anchors), "utf8");
}

/** List all anchors with zone; hot first then later; each zone sorted. */
export async function listAnchors(baseDir?: string): Promise<FutureSightListedAnchor[]> {
  const hot = sortAnchors(await readZoneAnchors("hot", baseDir)).map((a) => ({
    ...a,
    zone: "hot" as const,
  }));
  const later = sortAnchors(await readZoneAnchors("later", baseDir)).map((a) => ({
    ...a,
    zone: "later" as const,
  }));
  return [...hot, ...later];
}

/** @deprecated Use listAnchors. */
export async function listActiveAnchors(): Promise<FutureSightAnchor[]> {
  return listAnchors();
}

export async function countZoneAnchors(): Promise<{
  total: number;
  hot: number;
  later: number;
}> {
  const hot = (await readZoneAnchors("hot")).length;
  const later = (await readZoneAnchors("later")).length;
  return { total: hot + later, hot, later };
}

/** Count of all zone items (status.future_sight_active_count). */
export async function countActiveAnchors(): Promise<number> {
  return (await countZoneAnchors()).total;
}

/** Which zone an eligible (non-expired, in-window) anchor belongs in. */
export function assignZone(
  a: FutureSightAnchor,
  today: string,
  hotDays: number,
  windowDays: number,
): FutureSightZone | "expired" | "out_of_window" {
  if (a.anchor_end < today) return "expired";
  const hotLast = addCalendarDays(today, hotDays);
  const windowLast = addCalendarDays(today, windowDays);
  if (a.anchor_start > windowLast) return "out_of_window";
  if (a.anchor_start <= hotLast) return "hot";
  return "later";
}

/** Whether content may enter future-sight on extract. */
export function mayEnterFutureSight(
  a: Pick<FutureSightAnchor, "anchor_start" | "anchor_end">,
  today = calendarDate(),
  windowDays = config.futureSightWindowDays,
): boolean {
  const windowLast = addCalendarDays(today, windowDays);
  return a.anchor_start <= windowLast && a.anchor_end >= today;
}

export function isExpired(a: FutureSightAnchor, today = calendarDate()): boolean {
  return a.anchor_end < today;
}

async function emitRemovalEvent(
  a: FutureSightAnchor,
  reason: "past_anchor_end" | "out_of_window",
): Promise<void> {
  const label = reason === "past_anchor_end" ? "expired" : "out of window";
  const raw =
    `Future-sight ${label}: ${a.id} (${a.anchor_start}→${a.anchor_end}). ` +
    `${a.content.trim().slice(0, 400)}`;

  await captureActivity({
    raw,
    source: "system/future_sight_expired",
    ingest_meta: {
      future_sight_id: a.id,
      reason,
      anchor_start: a.anchor_start,
      anchor_end: a.anchor_end,
    },
  });
}

/**
 * Calendar maintenance for live or draft zone files.
 * Live: expire/out-of-window emit L0+short-term. Draft: no system events;
 * expired items stay for 409; out-of-window dropped from draft.
 */
export async function maintainFutureSight(
  opts: MaintainFutureSightOpts,
): Promise<MaintainFutureSightResult> {
  const mode = opts.mode;
  const target = opts.target ?? "live";
  const today = opts.today ?? calendarDate();
  const windowDays = opts.windowDays ?? config.futureSightWindowDays;
  const hotDays = opts.hotDays ?? config.futureSightHotDays;
  const baseDir = target === "draft" ? opts.baseDir : undefined;
  if (target === "draft" && !baseDir) {
    throw new Error("maintainFutureSight: draft target requires baseDir");
  }

  if (target === "live") {
    await ensureFutureSightFiles();
  }

  const beforeHot = await readZoneAnchors("hot", baseDir);
  const beforeLater = await readZoneAnchors("later", baseDir);
  const hotPath = zonePath("hot", baseDir);
  const laterPath = zonePath("later", baseDir);
  const needsCanonical =
    ((await exists(hotPath)) && zoneFileHasDroppedKeys(await readFile(hotPath, "utf8"))) ||
    ((await exists(laterPath)) && zoneFileHasDroppedKeys(await readFile(laterPath, "utf8")));

  const all = [...beforeHot, ...beforeLater];
  const byId = new Map<string, FutureSightAnchor>();
  for (const a of all) byId.set(a.id, a);

  const expired: string[] = [];
  const out_of_window: string[] = [];
  const stale_expired: string[] = [];
  const hot: FutureSightAnchor[] = [];
  const later: FutureSightAnchor[] = [];

  for (const a of byId.values()) {
    const bucket = assignZone(a, today, hotDays, windowDays);

    if (mode === "expire_only") {
      if (bucket === "expired") {
        if (target === "live") {
          await emitRemovalEvent(a, "past_anchor_end");
          expired.push(a.id);
        } else {
          stale_expired.push(a.id);
          hot.push(a);
        }
        continue;
      }
      if (beforeHot.some((x) => x.id === a.id)) hot.push(a);
      else later.push(a);
      continue;
    }

    // full
    if (bucket === "expired") {
      if (target === "live") {
        await emitRemovalEvent(a, "past_anchor_end");
        expired.push(a.id);
      } else {
        stale_expired.push(a.id);
        hot.push(a);
      }
      continue;
    }
    if (bucket === "out_of_window") {
      if (target === "live") {
        await emitRemovalEvent(a, "out_of_window");
        out_of_window.push(a.id);
      } else {
        out_of_window.push(a.id);
      }
      continue;
    }
    if (bucket === "hot") hot.push(a);
    else later.push(a);
  }

  const sameIds = (a: FutureSightAnchor[], b: FutureSightAnchor[]) => {
    const sa = sortAnchors(a);
    const sb = sortAnchors(b);
    if (sa.length !== sb.length) return false;
    return sa.every((x, i) => {
      const y = sb[i];
      return (
        x.id === y.id &&
        x.anchor_start === y.anchor_start &&
        x.anchor_end === y.anchor_end &&
        x.content === y.content
      );
    });
  };

  const changed =
    needsCanonical || !sameIds(beforeHot, hot) || !sameIds(beforeLater, later);

  if (changed) {
    await writeZoneAnchors("hot", hot, baseDir);
    await writeZoneAnchors("later", later, baseDir);
  }

  let committed = false;
  if (changed && opts.commit && target === "live") {
    const paths = [
      futureSightZoneRel("hot"),
      futureSightZoneRel("later"),
      "memories/activities/events.jsonl",
      "memories/short-term-memory",
    ];
    committed = await stageAndCommitPaths(paths, "engram: future-sight maintain");
  }

  return { expired, out_of_window, stale_expired, changed, committed };
}

/**
 * Lazy sweep used by GET: expire-only + commit when files change.
 */
export async function sweepExpiredFutureSight(today = calendarDate()): Promise<string[]> {
  const result = await maintainFutureSight({
    mode: "expire_only",
    target: "live",
    today,
    commit: true,
  });
  return result.expired;
}

/**
 * Replace both zone files with the given partitioned anchors (used by migrate／tests).
 */
export async function writeAllZones(opts: {
  hot: FutureSightAnchor[];
  later: FutureSightAnchor[];
  baseDir?: string;
}): Promise<void> {
  await writeZoneAnchors("hot", opts.hot, opts.baseDir);
  await writeZoneAnchors("later", opts.later, opts.baseDir);
}

/** Upsert one anchor into the correct live zone (typed patch helper). */
export async function upsertLiveAnchor(
  a: FutureSightAnchor,
  today = calendarDate(),
): Promise<FutureSightZone | null> {
  await ensureFutureSightFiles();
  const bucket = assignZone(a, today, config.futureSightHotDays, config.futureSightWindowDays);
  if (bucket === "expired" || bucket === "out_of_window") return null;

  const hot = (await readZoneAnchors("hot")).filter((x) => x.id !== a.id);
  const later = (await readZoneAnchors("later")).filter((x) => x.id !== a.id);
  if (bucket === "hot") hot.push(a);
  else later.push(a);
  await writeZoneAnchors("hot", hot);
  await writeZoneAnchors("later", later);
  return bucket;
}

/** Collect stale future patches (anchor_end < today) for approve gate (typed legacy). */
export function staleFutureAnchorIds(
  patches: Array<{ type: string; id?: string; anchor_end?: string }>,
  today = calendarDate(),
): string[] {
  const out: string[] = [];
  for (const p of patches) {
    if (p.type === "future" && typeof p.anchor_end === "string" && p.anchor_end < today) {
      if (typeof p.id === "string") out.push(p.id);
    }
  }
  return [...new Set(out)].sort();
}

/** Collect ids from draft zone files for draft_summary.future_ids. */
export async function listDraftFutureIds(draftRoot: string): Promise<string[]> {
  const listed = await listAnchors(draftRoot);
  return listed.map((a) => a.id).sort();
}
