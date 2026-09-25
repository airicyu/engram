import { mkdir, readdir, readFile, appendFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
  chainDir,
  chainFile,
  defaultPiModel,
  memoriesDir,
  nodeFile,
  nodesDir,
  poolArchivedPath,
  poolPendingPath,
  storeDir,
  workspacePath,
  type ChainLevel,
} from "../config/paths.ts";
import { isValidWeekId, weekDateRange } from "../chain/time.ts";
import { isValidNodeId } from "../nodes/id.ts";
import { parseActivityScoreFromMarkdown } from "../nodes/score.ts";


export type AttachmentRef = { path: string; relationship: string };

export type EventRow = {
  id: string;
  ts: string;
  raw: string;
  note?: string;
  attachments?: AttachmentRef[];
};

export type Workspace = {
  timezone: string;
  memory_language: string;
  pi_model: string;
};

export async function readWorkspace(): Promise<Workspace> {
  const fromEnv = process.env.ENGRAM_LITE_PI_MODEL?.trim() || process.env.PI_MODEL?.trim();
  try {
    const text = await readFile(workspacePath(), "utf8");
    const tz = text.match(/^timezone:\s*(.+)$/m)?.[1]?.trim() ?? "Asia/Hong_Kong";
    const lang = text.match(/^memory_language:\s*(.+)$/m)?.[1]?.trim() ?? "zh-Hant";
    const fromFile = text.match(/^pi_model:\s*(.+)$/m)?.[1]?.trim();
    return {
      timezone: tz,
      memory_language: lang,
      pi_model: fromEnv || fromFile || defaultPiModel,
    };
  } catch {
    return {
      timezone: process.env.ENGRAM_LITE_TZ ?? "Asia/Hong_Kong",
      memory_language: "zh-Hant",
      pi_model: fromEnv || defaultPiModel,
    };
  }
}

export async function readJsonl(path: string): Promise<EventRow[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const rows: EventRow[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as EventRow;
      if (o && typeof o.id === "string") rows.push(o);
    } catch {
      /* skip bad line */
    }
  }
  return rows.reverse();
}

export async function readPool() {
  const [pending, archived] = await Promise.all([
    readJsonl(poolPendingPath()),
    readJsonl(poolArchivedPath()),
  ]);
  return { pending, archived };
}

const ID_ALPH = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomEventSuffix(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ID_ALPH[Math.floor(Math.random() * ID_ALPH.length)]!;
  return s;
}

export function stampInTimezone(timeZone: string, at = new Date()): { ts: string; ymd: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const y = p.year!;
  const mo = p.month!;
  const d = p.day!;
  const h = p.hour!;
  const mi = p.minute!;
  const s = p.second!;
  const utc = at.getTime();
  const asUtc = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  const offMin = Math.round((asUtc - utc) / 60000);
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return {
    ts: `${y}-${mo}-${d}T${h}:${mi}:${s}${off}`,
    ymd: `${y}${mo}${d}`,
  };
}

export async function appendPending(raw: string): Promise<EventRow> {
  const text = raw.trim();
  if (!text) throw new Error("missing_raw");
  const ws = await readWorkspace();
  const { ts, ymd } = stampInTimezone(ws.timezone);
  const [pending, archived] = await Promise.all([
    readJsonl(poolPendingPath()),
    readJsonl(poolArchivedPath()),
  ]);
  const seen = new Set([...pending, ...archived].map((e) => e.id));
  let id = `evt_${ymd}_${randomEventSuffix()}`;
  for (let i = 0; i < 16 && seen.has(id); i++) id = `evt_${ymd}_${randomEventSuffix()}`;
  const row: EventRow = { id, ts, raw: text };
  const path = poolPendingPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(row) + "\n", "utf8");
  return row;
}

async function walkMd(dir: string): Promise<string[]> {
  const acc: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) acc.push(...(await walkMd(p)));
    else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function idFromChainPath(level: ChainLevel, filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  return base.replace(/\.md$/, "");
}

export async function listChain(level: ChainLevel): Promise<string[]> {
  const sub =
    level === "day"
      ? join(chainDir(), "days")
      : level === "week"
        ? join(chainDir(), "weeks")
        : level === "month"
          ? join(chainDir(), "months")
          : join(chainDir(), "years");
  const files = await walkMd(sub);
  let ids = files.map((f) => idFromChainPath(level, f));
  if (level === "week") ids = ids.filter((id) => isValidWeekId(id));
  return [...new Set(ids)].sort().reverse();
}

export type ChainReadResult = {
  id: string;
  present: boolean;
  markdown: string | null;
  path: string | null;
  start?: string;
  end?: string;
};

export async function readChain(level: ChainLevel, id: string): Promise<ChainReadResult> {
  const path = chainFile(level, id);
  if (!path) return { id, present: false, markdown: null, path: null };
  const weekRange = level === "week" ? weekDateRange(id) : null;
  try {
    const markdown = await readFile(path, "utf8");
    return weekRange
      ? { id, present: true, markdown, path, start: weekRange.start, end: weekRange.end }
      : { id, present: true, markdown, path };
  } catch {
    return weekRange
      ? { id, present: false, markdown: null, path, start: weekRange.start, end: weekRange.end }
      : { id, present: false, markdown: null, path };
  }
}

export type ChainIndexItem = {
  id: string;
  preview?: string;
  start?: string;
  end?: string;
};

function stripMarkdownFrontmatter(md: string): string {
  const m = String(md).match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
}

/** Plain text for list previews (wikilink labels, no markdown). */
export function wikilinksToPlainText(text: string): string {
  return String(text).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    const bit = label != null ? String(label) : String(id).split("/").pop() || String(id);
    return bit.trim();
  });
}

export function chainPreviewFromMarkdown(markdown: string): string {
  let text = wikilinksToPlainText(stripMarkdownFrontmatter(markdown));
  text = text.replace(/!\[\[[^\]]+\]\]/g, " ");
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= 80) return text;
  return `${text.slice(0, 80)}…`;
}

export async function listChainIndex(level: ChainLevel): Promise<ChainIndexItem[]> {
  const ids = await listChain(level);
  const items: ChainIndexItem[] = [];
  for (const id of ids) {
    const row = await readChain(level, id);
    const item: ChainIndexItem = { id };
    if (row.start && row.end) {
      item.start = row.start;
      item.end = row.end;
    }
    if (row.present && row.markdown) {
      const preview = chainPreviewFromMarkdown(row.markdown);
      if (preview) item.preview = preview;
    }
    items.push(item);
  }
  return items;
}

export async function listNodes(): Promise<
  { id: string; title: string; activity_score?: number | null }[]
> {
  let ids: string[];
  try {
    ids = await readdir(nodesDir());
  } catch {
    return [];
  }
  const out: { id: string; title: string }[] = [];
  for (const id of ids.sort()) {
    const p = nodeFile(id);
    if (!p) continue;
    try {
      const md = await readFile(p, "utf8");
      const body = md.replace(/^---[\s\S]*?---\s*/, "");
      const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
      const activity_score = parseActivityScoreFromMarkdown(md);
      const row: { id: string; title: string; activity_score?: number | null } = { id, title };
      if (activity_score != null) row.activity_score = activity_score;
      out.push(row);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function readNode(id: string) {
  const path = nodeFile(id);
  if (!path) return { id, present: false, markdown: null as string | null };
  try {
    const markdown = await readFile(path, "utf8");
    const activity_score = parseActivityScoreFromMarkdown(markdown);
    const base = { id, present: true as const, markdown };
    return activity_score != null ? { ...base, activity_score } : base;
  } catch {
    return { id, present: false, markdown: null };
  }
}


export type SearchHit = { path: string; snippet: string };

const SEARCH_LIMIT = 50;
const SNIPPET_RADIUS = 40;

export function snippetAround(text: string, q: string, radius = SNIPPET_RADIUS): string {
  const hay = text.toLowerCase();
  const needle = q.toLowerCase();
  const at = hay.indexOf(needle);
  if (at < 0) {
    return text.replace(/\s+/g, " ").trim().slice(0, radius * 2);
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + needle.length + radius);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = "…" + snip;
  if (end < text.length) snip = snip + "…";
  return snip;
}

function vaultRel(absPath: string, vaultRoot: string): string {
  return relative(vaultRoot, absPath).split("\\").join("/");
}

/** Keyword search over chain + nodes + future-sight + pending.jsonl. Does not scan archived/jobs/attachments/clarify. */
export async function searchMemories(q: string, vaultRoot = memoriesDir()): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  const hits: SearchHit[] = [];
  const needle = query.toLowerCase();

  const pushMd = async (abs: string) => {
    if (hits.length >= SEARCH_LIMIT) return;
    let text: string;
    try {
      text = await readFile(abs, "utf8");
    } catch {
      return;
    }
    if (!text.toLowerCase().includes(needle)) return;
    hits.push({ path: vaultRel(abs, vaultRoot), snippet: snippetAround(text, query) });
  };

  for (const abs of await walkMd(join(vaultRoot, "chain"))) {
    await pushMd(abs);
    if (hits.length >= SEARCH_LIMIT) return hits;
  }
  for (const abs of await walkMd(join(vaultRoot, "nodes"))) {
    await pushMd(abs);
    if (hits.length >= SEARCH_LIMIT) return hits;
  }
  const fsDir = join(vaultRoot, "future-sight");
  try {
    for (const abs of await walkMd(fsDir)) {
      await pushMd(abs);
      if (hits.length >= SEARCH_LIMIT) return hits;
    }
  } catch {
    /* no future-sight dir */
  }

  const pendingPath = join(vaultRoot, "pool", "pending.jsonl");
  let pendingText = "";
  try {
    pendingText = await readFile(pendingPath, "utf8");
  } catch {
    pendingText = "";
  }
  if (pendingText) {
    const rel = "pool/pending.jsonl";
    for (const line of pendingText.split("\n")) {
      if (hits.length >= SEARCH_LIMIT) break;
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t) as { raw?: string; note?: string };
        const raw = typeof o.raw === "string" ? o.raw : "";
        const note = typeof o.note === "string" ? o.note : "";
        const blob = raw + (note ? "\n" + note : "");
        if (!blob.toLowerCase().includes(needle)) continue;
        hits.push({ path: rel, snippet: snippetAround(blob, query) });
      } catch {
        /* skip bad line */
      }
    }
  }

  return hits;
}

export type ClarifyBucket = "asking" | "pending" | "history";

export type ClarifyItem = {
  id: string;
  ts: string;
  markdown: string;
};

export const CLA_ID_RE = /^cla_\d{8}_[a-z0-9]{6}$/;

export function isValidClarifyId(id: string): boolean {
  return CLA_ID_RE.test(id);
}

export async function ensureClarifyDirs(vaultRoot = memoriesDir()): Promise<void> {
  for (const b of ["asking", "pending", "history"] as const) {
    await mkdir(join(vaultRoot, "clarify", b), { recursive: true });
  }
}

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] ?? "" };
}

function formatFrontmatter(meta: Record<string, string>, body: string): string {
  const lines = Object.entries(meta).map(([k, v]) => `${k}: ${v}`);
  const bodyText = body.replace(/^\n+/, "");
  return `---\n${lines.join("\n")}\n---\n\n${bodyText.replace(/\s+$/, "")}\n`;
}

async function listClarifyBucket(
  bucket: "asking" | "pending",
  vaultRoot = memoriesDir(),
): Promise<ClarifyItem[]> {
  const dir = join(vaultRoot, "clarify", bucket);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const items: ClarifyItem[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const abs = join(dir, name);
    let markdown: string;
    try {
      markdown = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const { meta } = parseFrontmatter(markdown);
    const id = meta.id || name.replace(/\.md$/, "");
    const ts = meta.ts || "";
    items.push({ id, ts, markdown });
  }
  items.sort((a, b) => {
    if (a.ts && b.ts && a.ts !== b.ts) return a.ts < b.ts ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  return items;
}

export async function listClarifyAsking(vaultRoot = memoriesDir()): Promise<ClarifyItem[]> {
  return listClarifyBucket("asking", vaultRoot);
}

export async function listClarifyPending(vaultRoot = memoriesDir()): Promise<ClarifyItem[]> {
  return listClarifyBucket("pending", vaultRoot);
}

export async function submitClarifyAnswer(
  id: string,
  answer: string,
  vaultRoot = memoriesDir(),
): Promise<{ id: string; present: boolean }> {
  if (!isValidClarifyId(id)) throw new Error("invalid_id");
  const text = answer.trim();
  if (!text) throw new Error("missing_answer");
  await ensureClarifyDirs(vaultRoot);
  const src = join(vaultRoot, "clarify", "asking", `${id}.md`);
  let md: string;
  try {
    md = await readFile(src, "utf8");
  } catch {
    return { id, present: false };
  }
  const { meta, body } = parseFrontmatter(md);
  meta.id = meta.id || id;
  if (!meta.ts) {
    const ws = await readWorkspace();
    meta.ts = stampInTimezone(ws.timezone).ts;
  }
  let nextBody = body.replace(/\s+$/, "");
  if (!/^##\s+Answer\s*$/m.test(nextBody)) {
    nextBody = `${nextBody}\n\n## Answer\n\n${text}\n`;
  } else {
    nextBody = nextBody.replace(/(##\s+Answer\s*\n)([\s\S]*)$/m, `$1\n${text}\n`);
  }
  const out = formatFrontmatter(meta, nextBody);
  const dest = join(vaultRoot, "clarify", "pending", `${id}.md`);
  await writeFile(dest, out, "utf8");
  await unlink(src);
  return { id, present: true };
}

export async function dismissClarify(
  id: string,
  vaultRoot = memoriesDir(),
): Promise<{ id: string; present: boolean }> {
  if (!isValidClarifyId(id)) throw new Error("invalid_id");
  await ensureClarifyDirs(vaultRoot);
  const src = join(vaultRoot, "clarify", "asking", `${id}.md`);
  let md: string;
  try {
    md = await readFile(src, "utf8");
  } catch {
    return { id, present: false };
  }
  const { meta, body } = parseFrontmatter(md);
  meta.id = meta.id || id;
  if (!meta.ts) {
    const ws = await readWorkspace();
    meta.ts = stampInTimezone(ws.timezone).ts;
  }
  meta.dismissed = "true";
  const dest = join(vaultRoot, "clarify", "history", `${id}.md`);
  await writeFile(dest, formatFrontmatter(meta, body), "utf8");
  await unlink(src);
  return { id, present: true };
}

export async function createClarifyAside(
  raw: string,
  vaultRoot = memoriesDir(),
): Promise<{ id: string; present: true }> {
  const text = raw.trim();
  if (!text) throw new Error("missing_raw");
  await ensureClarifyDirs(vaultRoot);
  const ws = await readWorkspace();
  const { ts, ymd } = stampInTimezone(ws.timezone);
  let id = `cla_${ymd}_${randomEventSuffix()}`;
  const pendingDir = join(vaultRoot, "clarify", "pending");
  for (let i = 0; i < 16; i++) {
    try {
      await readFile(join(pendingDir, `${id}.md`), "utf8");
      id = `cla_${ymd}_${randomEventSuffix()}`;
    } catch {
      break;
    }
  }
  const md = formatFrontmatter({ id, ts, kind: "aside" }, text);
  await writeFile(join(pendingDir, `${id}.md`), md, "utf8");
  return { id, present: true };
}

// ─── Attachments (0.3.0 Track C) ───────────────────────────────────────────


export const ALLOWED_ATTACH_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

/** Vault-relative path: `_attachments/uploads/YYYY-MM-DD/filename` (filename single segment). */
export const ATTACH_PATH_RE =
  /^_attachments\/uploads\/(\d{4}-\d{2}-\d{2})\/([^/|\\\]\n]+)$/;


/** Any attachment-shaped embed (incl. alias / illegal) for rejection scan. */
const ATTACH_EMBED_ANY_RE = /!\[\[(_attachments\/uploads\/[^\]]*)\]\]/g;

export function isValidAttachPath(path: string): boolean {
  if (!ATTACH_PATH_RE.test(path)) return false;
  const file = path.split("/").pop() ?? "";
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) return false;
  return true;
}

export function localDayString(timeZone: string, at = new Date()): string {
  const { ts } = stampInTimezone(timeZone, at);
  return ts.slice(0, 10);
}

export function localHHmmss(timeZone: string, at = new Date()): string {
  const { ts } = stampInTimezone(timeZone, at);
  // ts = YYYY-MM-DDTHH:mm:ss±HH:mm
  return ts.slice(11, 19).replace(/:/g, "");
}

export function sanitizeAttachFilename(name: string, mime: string): string {
  let n = name.trim();
  const slash = Math.max(n.lastIndexOf("/"), n.lastIndexOf("\\"));
  if (slash >= 0) n = n.slice(slash + 1);
  if (!n || n.includes("..") || n.includes("/") || n.includes("\\") || n.includes("|")) {
    n = `upload${extFromMime(mime)}`;
  }
  // single segment only; strip any residual path chars
  n = n.replace(/[/\\]/g, "");
  if (!n || n === "." || n === "..") n = `upload${extFromMime(mime)}`;
  return n;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".bin";
  }
}

export function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export type UploadResult = { path: string; day: string; filename: string };

/** Write bytes to formal `memories/_attachments/uploads/{day}/` (no tmp). */
export async function saveAttachmentUpload(
  bytes: Uint8Array,
  candidateName: string,
  mime: string,
  vaultRoot = memoriesDir(),
): Promise<UploadResult> {
  if (!ALLOWED_ATTACH_MIME.has(mime)) throw new Error("invalid_mime");
  if (bytes.byteLength > MAX_ATTACH_BYTES) throw new Error("file_too_large");
  if (bytes.byteLength === 0) throw new Error("empty_file");

  const ws = await readWorkspace();
  const day = localDayString(ws.timezone);
  let filename = sanitizeAttachFilename(candidateName, mime);

  const dir = join(vaultRoot, "_attachments", "uploads", day);
  await mkdir(dir, { recursive: true });

  let dest = join(dir, filename);
  try {
    await readFile(dest);
    // collision → {stem}-{HHmmss}-{rand6}.ext
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    const stamp = localHHmmss(ws.timezone);
    filename = `${stem}-${stamp}-${randomEventSuffix()}${ext}`;
    dest = join(dir, filename);
  } catch {
    /* free */
  }

  await writeFile(dest, bytes);
  const path = `_attachments/uploads/${day}/${filename}`;
  return { path, day, filename };
}

export function absAttachPath(relPath: string, vaultRoot = memoriesDir()): string | null {
  if (!isValidAttachPath(relPath)) return null;
  const abs = join(vaultRoot, ...relPath.split("/"));
  const root = join(vaultRoot, "_attachments", "uploads");
  const normAbs = abs.replace(/\\/g, "/");
  const normRoot = root.replace(/\\/g, "/");
  if (!normAbs.startsWith(normRoot + "/") && normAbs !== normRoot) return null;
  return abs;
}

export async function attachmentFileExists(
  relPath: string,
  vaultRoot = memoriesDir(),
): Promise<boolean> {
  const abs = absAttachPath(relPath, vaultRoot);
  if (!abs) return false;
  try {
    await readFile(abs);
    return true;
  } catch {
    return false;
  }
}

/** Extract exact embed paths; throw on alias / malformed attachment embeds. */
export function extractAttachEmbeds(raw: string): string[] {
  const anyHits = [...raw.matchAll(ATTACH_EMBED_ANY_RE)];
  const paths: string[] = [];
  for (const m of anyHits) {
    const inner = m[1] ?? "";
    if (inner.includes("|")) throw new Error("embed_alias");
    const exact = `![[${inner}]]`;
    const ok = exact.match(/^!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^|/\]\n]+)\]\]$/);
    if (!ok || !isValidAttachPath(ok[1]!)) throw new Error("invalid_embed");
    paths.push(ok[1]!);
  }
  return paths;
}

export type EventAttachError =
  | "embed_alias"
  | "invalid_embed"
  | "invalid_attach_path"
  | "missing_relationship"
  | "asymmetric_attachments"
  | "missing_file";

/**
 * Symmetry: if raw has any valid embed OR attachments is non-empty,
 * path sets must be equal; every path must exist; relationship trim non-empty.
 * No embed + omit/empty attachments → ok (0.2).
 */
export async function validateEventAttachments(
  raw: string,
  attachments: AttachmentRef[] | undefined | null,
  vaultRoot = memoriesDir(),
): Promise<{ ok: true; attachments?: AttachmentRef[] } | { ok: false; error: EventAttachError }> {
  let embedPaths: string[];
  try {
    embedPaths = extractAttachEmbeds(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "embed_alias") return { ok: false, error: "embed_alias" };
    return { ok: false, error: "invalid_embed" };
  }

  const list = Array.isArray(attachments) ? attachments : [];
  const hasEmbeds = embedPaths.length > 0;
  const hasAtt = list.length > 0;

  if (!hasEmbeds && !hasAtt) return { ok: true };

  const normalized: AttachmentRef[] = [];
  for (const a of list) {
    const path = typeof a?.path === "string" ? a.path.trim() : "";
    const relationship = typeof a?.relationship === "string" ? a.relationship.trim() : "";
    if (!path || !isValidAttachPath(path)) return { ok: false, error: "invalid_attach_path" };
    if (!relationship) return { ok: false, error: "missing_relationship" };
    normalized.push({ path, relationship });
  }

  const embedSet = new Set(embedPaths);
  const attSet = new Set(normalized.map((a) => a.path));
  if (embedSet.size !== attSet.size) return { ok: false, error: "asymmetric_attachments" };
  for (const p of embedSet) {
    if (!attSet.has(p)) return { ok: false, error: "asymmetric_attachments" };
  }

  for (const p of embedSet) {
    if (!(await attachmentFileExists(p, vaultRoot))) return { ok: false, error: "missing_file" };
  }

  // Deduplicate attachments by path (keep first relationship)
  const seen = new Set<string>();
  const uniq: AttachmentRef[] = [];
  for (const a of normalized) {
    if (seen.has(a.path)) continue;
    seen.add(a.path);
    uniq.push(a);
  }
  return { ok: true, attachments: uniq };
}

export async function appendPendingWithAttachments(
  raw: string,
  attachments?: AttachmentRef[] | null,
  vaultRoot = memoriesDir(),
): Promise<EventRow> {
  const text = raw.trim();
  if (!text) throw new Error("missing_raw");
  const checked = await validateEventAttachments(text, attachments, vaultRoot);
  if (!checked.ok) throw new Error(checked.error);

  const ws = await readWorkspace();
  const { ts, ymd } = stampInTimezone(ws.timezone);
  const pendingPath = join(vaultRoot, "pool", "pending.jsonl");
  const archivedPath = join(vaultRoot, "pool", "archived.jsonl");
  const [pending, archived] = await Promise.all([readJsonl(pendingPath), readJsonl(archivedPath)]);
  const seen = new Set([...pending, ...archived].map((e) => e.id));
  let id = `evt_${ymd}_${randomEventSuffix()}`;
  for (let i = 0; i < 16 && seen.has(id); i++) id = `evt_${ymd}_${randomEventSuffix()}`;

  const row: EventRow = { id, ts, raw: text };
  if (checked.attachments && checked.attachments.length) {
    row.attachments = checked.attachments;
  }
  await mkdir(dirname(pendingPath), { recursive: true });
  await appendFile(pendingPath, JSON.stringify(row) + "\n", "utf8");
  return row;
}

// ─── Node graph (0.3.0 Track D) ────────────────────────────────────────────

export type GraphNode = { id: string; title: string };
export type GraphEdge = { from: string; to: string };
export type NodeGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** P1: `[[nodes/{id}/{id}|label]]` — both path segments must match (id may be Unicode). */
export const NODE_WIKILINK_RE = /\[\[nodes\/([^/\]]+)\/\1(?:\|[^\]]*)?\]\]/g;

/** Extract target node ids from markdown body. Ignores mismatched path segments. */
export function extractNodeWikilinks(md: string): string[] {
  const out: string[] = [];
  const re = new RegExp(NODE_WIKILINK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const id = m[1]!;
    if (isValidNodeId(id)) out.push(id);
  }
  return out;
}

/**
 * Build undirected graph from existing nodes + wikilinks.
 * Dead links (target missing) ignored; A–B deduped with lexicographically smaller as `from`.
 * Empty vault → `{ nodes: [], edges: [] }`.
 */
export async function buildNodeGraph(vaultRoot = memoriesDir()): Promise<NodeGraph> {
  const nodesRoot = join(vaultRoot, "nodes");
  let ids: string[];
  try {
    ids = await readdir(nodesRoot);
  } catch {
    return { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = [];
  const present = new Set<string>();
  const mdById = new Map<string, string>();

  for (const id of ids.sort()) {
    if (!isValidNodeId(id)) continue;
    const p = join(nodesRoot, id, `${id}.md`);
    let md: string;
    try {
      md = await readFile(p, "utf8");
    } catch {
      continue;
    }
    const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
    nodes.push({ id, title });
    present.add(id);
    mdById.set(id, md);
  }

  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const [fromId, md] of mdById) {
    for (const toId of extractNodeWikilinks(md)) {
      if (toId === fromId) continue;
      if (!present.has(toId)) continue;
      const a = fromId < toId ? fromId : toId;
      const b = fromId < toId ? toId : fromId;
      const key = `${a}\0${b}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: a, to: b });
    }
  }

  edges.sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : x.to > y.to ? 1 : 0));

  return { nodes, edges };
}
