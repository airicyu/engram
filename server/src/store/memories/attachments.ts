/** Media attachment storage: ensure, upload, move, validation, housekeep, gitignore. */

import { access, mkdir, rename, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config";
import { homePath } from "../home";
import { calendarDate, nowIso } from "./activities";
import { compactStampFromIso } from "../run-id";
import { ensureStoreGitignore } from "../git";
import { logInfo } from "../../log";

/** Allowed MIME types for uploads. */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Maximum bytes default (10 MiB). */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** Path validation regex: day must be YYYY-MM-DD. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Filename must be a single segment without path traversal. */
function isValidFilename(name: string): boolean {
  if (!name || name === "." || name === "..") return false;
  if (name.includes("/") || name.includes("\\")) return false;
  return true;
}

/** Validate an attachment path string: must be exactly `_attachments/uploads/{day}/{filename}`. */
export function isValidAttachmentPath(path: string): { valid: false } | {
  valid: true;
  day: string;
  filename: string;
} {
  const parts = path.split("/");
  if (parts.length !== 4) return { valid: false };
  if (parts[0] !== "_attachments" || parts[1] !== "uploads") return { valid: false };
  const day = parts[2]!;
  const filename = parts[3]!;
  if (!DAY_RE.test(day)) return { valid: false };
  if (!isValidFilename(filename)) return { valid: false };
  return { valid: true, day, filename };
}

export interface AttachmentMeta {
  path: string;
  relationship: string;
}

export interface UploadResult {
  path: string;
  day: string;
  filename: string;
}

export interface AttachmentValidationError {
  error: string;
  message: string;
}

/**
 * Conflict-safe filename: `{stem}-YYYYMMDD-HHmmss-{rand6}{ext}`.
 * Stamp uses effective timezone（＋虛擬鐘）via `nowIso()` — same as dream run ids.
 */
function conflictFilename(stem: string, ext: string, at = nowIso()): string {
  const stamp = compactStampFromIso(at);
  const rand6 = Math.random().toString(36).slice(2, 8);
  return `${stem}-${stamp}-${rand6}${ext}`;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    case "image/gif": return ".gif";
    default: return ".bin";
  }
}

function extFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function stemFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Ensure `_attachments/uploads/tmp/` and `_attachments/uploads/{day}/` dirs exist, gitignore tmp. */
export async function ensureAttachmentsDir(): Promise<void> {
  const tmpRoot = homePath("memories", "_attachments", "uploads", "tmp");
  await mkdir(tmpRoot, { recursive: true });

  // Ensure gitignore includes tmp
  await ensureStoreGitignore();
  await ensureTmpGitignore();
}

/** Ensure `memories/_attachments/uploads/tmp/` is gitignored. */
async function ensureTmpGitignore(): Promise<void> {
  const path = homePath(".gitignore");
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    // file doesn't exist yet
  }
  const lines = existing
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
  const have = new Set(lines.map((l) => l.trim()).filter(Boolean));
  const needed = "memories/_attachments/uploads/tmp/";
  if (!have.has(needed)) {
    lines.push(needed);
    await writeFile(path, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  }
}

/** Resolve a unique filename in the given directory. */
async function resolveUniqueFilename(
  dir: string,
  candidateName: string,
  at = nowIso(),
): Promise<string> {
  if (!(await exists(join(dir, candidateName)))) {
    return candidateName;
  }
  const stem = stemFromFilename(candidateName);
  const ext = extFromFilename(candidateName);
  return conflictFilename(stem, ext, at);
}

/**
 * Write upload bytes to tmp dir, resolve filename conflicts, return result.
 * The returned path is the final form (never contains /tmp).
 */
export async function writeUploadToTmp(
  buffer: Buffer,
  candidateName: string,
  mimeType: string,
): Promise<UploadResult> {
  await ensureAttachmentsDir();

  const day = calendarDate();
  const tmpDir = homePath("memories", "_attachments", "uploads", "tmp", day);
  await mkdir(tmpDir, { recursive: true });

  const formalDir = homePath("memories", "_attachments", "uploads", day);
  await mkdir(formalDir, { recursive: true });

  const at = nowIso();
  // Check both tmp and formal for uniqueness
  const tmpName = await resolveUniqueFilename(tmpDir, candidateName, at);
  // Also check formal dir for conflicts
  let finalName = tmpName;
  if (await exists(join(formalDir, tmpName))) {
    const stem = stemFromFilename(tmpName);
    const ext = extFromFilename(tmpName);
    finalName = conflictFilename(stem, ext, at);
  }

  await writeFile(join(tmpDir, finalName), buffer);

  return {
    path: `_attachments/uploads/${day}/${finalName}`,
    day,
    filename: finalName,
  };
}

/**
 * Move a file from tmp to formal directory.
 * Returns the formal path (always the same as the path field, since embed never has /tmp).
 */
export async function moveTmpToFormal(
  day: string,
  filename: string,
): Promise<void> {
  const tmpPath = homePath("memories", "_attachments", "uploads", "tmp", day, filename);
  const formalDir = homePath("memories", "_attachments", "uploads", day);
  await mkdir(formalDir, { recursive: true });
  const formalPath = join(formalDir, filename);
  await rename(tmpPath, formalPath);
}

/**
 * Best-effort move a file from formal back to tmp (rollback on write failure).
 * Logs but does not throw on failure.
 */
export async function moveFormalToTmp(
  day: string,
  filename: string,
): Promise<void> {
  try {
    const formalPath = homePath("memories", "_attachments", "uploads", day, filename);
    const tmpDir = homePath("memories", "_attachments", "uploads", "tmp", day);
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, filename);
    await rename(formalPath, tmpPath);
  } catch (e) {
    logInfo("attachment rollback failed", {
      day,
      filename,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Check if a tmp file exists.
 */
export async function tmpFileExists(day: string, filename: string): Promise<boolean> {
  return exists(homePath("memories", "_attachments", "uploads", "tmp", day, filename));
}

/**
 * Delete a tmp file. Idempotent — returns true even if file is missing.
 */
export async function deleteTmpFile(day: string, filename: string): Promise<void> {
  const path = homePath("memories", "_attachments", "uploads", "tmp", day, filename);
  if (await exists(path)) {
    await rm(path, { force: true });
  }
}

/**
 * Collect all `![[path]]` references from raw text.
 * Only exact form: `![[_attachments/uploads/{day}/{filename}]]`
 * Does NOT match `![[path|alias]]` variants.
 */
export function collectEmbedPaths(raw: string): string[] {
  const re = /!\[\[(_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/[^\]|]+)\]\]/g;
  const paths: string[] = [];
  for (const m of raw.matchAll(re)) {
    paths.push(m[1]!);
  }
  return paths;
}

/**
 * Detect non-exact attachment wikilinks (e.g., `![[path|alias]]`).
 * These are illegal per INDEX #19 — must be rejected with 400.
 */
export function collectNonExactAttachWikilinks(raw: string): string[] {
  // Match any `![[_attachments/uploads/...]]` that contains `|` (alias variant)
  const re = /!\[\[(_attachments\/uploads\/[^\]|]+\|[^\]]+)\]\]/g;
  const matches: string[] = [];
  for (const m of raw.matchAll(re)) {
    matches.push(m[0]);
  }
  return matches;
}

/**
 * Check if raw text contains the `## Attachment relationships` heading (double appendix guard).
 */
export function rawContainsAppendix(raw: string): boolean {
  return /^## Attachment relationships/m.test(raw);
}

/**
 * Validate attachments for POST /activities:
 * - Attachments and embeds must be symmetric (exact set equality)
 * - No duplicate paths
 * - Each relationship must be non-empty
 * - Each path must be valid
 * - Raw must not contain appendix heading
 * - Tmp files must exist for each attachment
 */
export async function validateAttachments(
  raw: string,
  attachments: AttachmentMeta[] | undefined,
): Promise<AttachmentValidationError | null> {
  // 0.29: reject non-exact attachment wikilinks (|alias) in all cases
  const nonExact = collectNonExactAttachWikilinks(raw);
  if (nonExact.length > 0) {
    return {
      error: "non_exact_attachment_wikilink",
      message: `Attachment wikilinks must use exact form ![[path]] without alias: ${nonExact[0]}`,
    };
  }

  if (!attachments || attachments.length === 0) {
    // No attachments: raw must not reference any _attachments/uploads/ embeds
    const embeds = collectEmbedPaths(raw);
    if (embeds.length > 0) {
      return {
        error: "embed_without_attachment",
        message: "Raw contains attachment embeds but no attachments list provided",
      };
    }
    return null;
  }

  // Check raw doesn't already contain appendix
  if (rawContainsAppendix(raw)) {
    return {
      error: "double_appendix",
      message: "Raw must not contain '## Attachment relationships' heading",
    };
  }

  // Check duplicate paths
  const seen = new Set<string>();
  for (const a of attachments) {
    if (seen.has(a.path)) {
      return {
        error: "duplicate_attachment_path",
        message: `Duplicate attachment path: ${a.path}`,
      };
    }
    seen.add(a.path);
  }

  // Validate each path
  for (const a of attachments) {
    const parsed = isValidAttachmentPath(a.path);
    if (!parsed.valid) {
      return {
        error: "invalid_attachment_path",
        message: `Invalid attachment path: ${a.path}`,
      };
    }
    // Check relationship non-empty
    if (!a.relationship || !a.relationship.trim()) {
      return {
        error: "empty_relationship",
        message: `Relationship is required for ${a.path}`,
      };
    }
    // Check tmp file exists
    if (!(await tmpFileExists(parsed.day, parsed.filename))) {
      return {
        error: "attachment_file_missing",
        message: `Attachment file not found in tmp: ${a.path}`,
      };
    }
  }

  // Symmetric check: embed paths in raw must equal attachments paths
  const embedPaths = collectEmbedPaths(raw);
  const embedSet = new Set(embedPaths);
  const attachSet = new Set(attachments.map((a) => a.path));

  // Check for embeds not in attachments
  for (const ep of embedPaths) {
    if (!attachSet.has(ep)) {
      return {
        error: "embed_not_in_attachments",
        message: `Embed ${ep} not listed in attachments`,
      };
    }
  }

  // Check for attachments not in embeds
  for (const ap of attachSet) {
    if (!embedSet.has(ap)) {
      return {
        error: "attachment_not_in_embeds",
        message: `Attachment ${ap} not referenced in raw text`,
      };
    }
  }

  return null;
}

/**
 * Build the appendix block from attachments array.
 */
export function buildAppendix(attachments: AttachmentMeta[]): string {
  if (!attachments || attachments.length === 0) return "";

  let appendix = "\n\n------\n\n## Attachment relationships\n\n";
  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i]!;
    appendix += `### ${i + 1}\n\n`;
    appendix += `**name:** ![[${a.path}]]\n\n`;
    appendix += `**relationship:**\n\n${a.relationship.trim()}\n`;
    if (i < attachments.length - 1) {
      appendix += "\n";
    }
  }
  return appendix;
}

/**
 * Housekeep: remove tmp directories older than retention days.
 * Compares directory name (YYYY-MM-DD) against effective clock's "today".
 */
export async function housekeepTmpUploads(): Promise<{ removed: string[] }> {
  await ensureAttachmentsDir();

  const retentionDays = config.attachmentTmpRetentionDays;
  const today = calendarDate();
  const tmpRoot = homePath("memories", "_attachments", "uploads", "tmp");

  if (!(await exists(tmpRoot))) return { removed: [] };

  const entries = await readdir(tmpRoot, { withFileTypes: true });

  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (!DAY_RE.test(dirName)) continue;

    // Calculate day difference
    const dirDate = new Date(dirName + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const diffMs = todayDate.getTime() - dirDate.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays >= retentionDays) {
      const dirPath = join(tmpRoot, dirName);
      await rm(dirPath, { recursive: true, force: true });
      removed.push(dirName);
    }
  }

  if (removed.length > 0) {
    logInfo("attachment housekeep", { removed: removed.length, retention_days: retentionDays });
  }

  return { removed };
}