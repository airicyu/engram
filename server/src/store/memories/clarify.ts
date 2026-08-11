/**
 * Clarify queues (0.30): asking／pending／history under memories/clarify/.
 * Not activities — no L0／STM／day ledger.
 */

import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homePath } from "../home";
import { nowIso } from "./activities";
import { parse, stringify } from "../../yaml";
import { stageAndCommitPaths } from "../git";
import { logInfo, logError } from "../../log";

export const CLARIFY_MAX_BYTES = 16 * 1024;
export const CLARIFY_ASKING_CAP = 10;
export const CLARIFY_RELATED_NODES_MAX = 16;
export const CLARIFY_GENERATE_MIN = 3;
export const CLARIFY_GENERATE_MAX = 5;

export type ClarifyKind = "prompt" | "aside";
export type ClarifyQueue = "asking" | "pending" | "history";

export interface ClarifyFrontmatter {
  id: string;
  kind: ClarifyKind;
  created_at: string;
  answered_at?: string;
  source_dream_run_id: string | null;
  related_nodes: string[];
}

export interface ClarifyAskingItem {
  id: string;
  kind: "prompt";
  created_at: string;
  source_dream_run_id: string | null;
  related_nodes: string[];
  question: string;
}

export interface ClarifyPendingItem {
  id: string;
  kind: ClarifyKind;
  created_at: string;
  answered_at: string;
  source_dream_run_id: string | null;
  related_nodes: string[];
  question: string | null;
  answer: string;
}

/** Serialize clarify mutations in this process (submit／dismiss／aside／generate／archive). */
let clarifyChain: Promise<unknown> = Promise.resolve();

export function withClarifyWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = clarifyChain.then(fn, fn);
  clarifyChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function clarifyQueueDir(queue: ClarifyQueue): string {
  return homePath("memories", "clarify", queue);
}

export function clarifyRel(queue: ClarifyQueue, id: string): string {
  return `memories/clarify/${queue}/${id}.md`;
}

export function clarifyAbs(queue: ClarifyQueue, id: string): string {
  return join(clarifyQueueDir(queue), `${id}.md`);
}

/** Ensure asking／pending／history directories exist (no migrate hop). */
export async function ensureClarifyDirs(): Promise<void> {
  for (const q of ["asking", "pending", "history"] as const) {
    await mkdir(clarifyQueueDir(q), { recursive: true });
  }
}

/** Reject path traversal / non-uuid-ish ids (uuid v4 without braces; also allow compact test ids). */
export function isValidClarifyId(id: string): boolean {
  if (!id || id.length > 80) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id);
}

export function utf8ByteLength(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

export function assertUtf8WithinLimit(label: string, s: string): void {
  if (utf8ByteLength(s) > CLARIFY_MAX_BYTES) {
    throw new ClarifyValidationError(
      "too_large",
      `${label} exceeds ${CLARIFY_MAX_BYTES} UTF-8 bytes`,
    );
  }
}

export class ClarifyValidationError extends Error {
  error: string;
  constructor(error: string, message: string) {
    super(message);
    this.name = "ClarifyValidationError";
    this.error = error;
  }
}

function normalizeRelatedNodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new ClarifyValidationError("invalid_related_nodes", "`related_nodes` must be an array of strings");
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string" || !x.trim()) {
      throw new ClarifyValidationError(
        "invalid_related_nodes",
        "`related_nodes` entries must be non-empty strings",
      );
    }
    const t = x.trim();
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  if (out.length > CLARIFY_RELATED_NODES_MAX) {
    throw new ClarifyValidationError(
      "related_nodes_too_many",
      `related_nodes exceeds max ${CLARIFY_RELATED_NODES_MAX}`,
    );
  }
  return out;
}

function extractSection(body: string, heading: string): string | null {
  const re = new RegExp(
    `^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "im",
  );
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

export function renderClarifyMarkdown(opts: {
  fm: ClarifyFrontmatter;
  question?: string | null;
  answer?: string | null;
}): string {
  const doc: Record<string, unknown> = {
    id: opts.fm.id,
    kind: opts.fm.kind,
    created_at: opts.fm.created_at,
    source_dream_run_id: opts.fm.source_dream_run_id,
    related_nodes: opts.fm.related_nodes,
  };
  if (opts.fm.answered_at) doc.answered_at = opts.fm.answered_at;

  const parts: string[] = ["---", stringify(doc).trimEnd(), "---", ""];
  if (opts.fm.kind === "prompt") {
    parts.push("## Question", "", (opts.question ?? "").trim(), "");
  }
  if (opts.answer != null) {
    parts.push("## Answer", "", opts.answer.trim(), "");
  }
  const out = parts.join("\n");
  return out.endsWith("\n") ? out : `${out}\n`;
}

export function parseClarifyMarkdown(
  text: string,
  expectedQueue: ClarifyQueue,
): {
  fm: ClarifyFrontmatter;
  question: string | null;
  answer: string | null;
} {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    throw new ClarifyValidationError("invalid_markdown", "missing YAML frontmatter");
  }
  let rawFm: Record<string, unknown>;
  try {
    rawFm = parse(fmMatch[1]!) as Record<string, unknown>;
  } catch {
    throw new ClarifyValidationError("invalid_markdown", "invalid YAML frontmatter");
  }
  if (!rawFm || typeof rawFm !== "object") {
    throw new ClarifyValidationError("invalid_markdown", "frontmatter must be an object");
  }
  const id = typeof rawFm.id === "string" ? rawFm.id.trim() : "";
  if (!isValidClarifyId(id)) {
    throw new ClarifyValidationError("invalid_id", "frontmatter id invalid");
  }
  const kind = rawFm.kind;
  if (kind !== "prompt" && kind !== "aside") {
    throw new ClarifyValidationError("invalid_kind", "kind must be prompt|aside");
  }
  const created_at = typeof rawFm.created_at === "string" ? rawFm.created_at : "";
  if (!created_at) {
    throw new ClarifyValidationError("invalid_created_at", "created_at required");
  }
  const source_dream_run_id =
    rawFm.source_dream_run_id === null
      ? null
      : typeof rawFm.source_dream_run_id === "string"
        ? rawFm.source_dream_run_id
        : (() => {
            throw new ClarifyValidationError(
              "invalid_source_dream_run_id",
              "source_dream_run_id must be string|null",
            );
          })();
  const related_nodes = normalizeRelatedNodes(rawFm.related_nodes ?? []);
  const answered_at =
    typeof rawFm.answered_at === "string" ? rawFm.answered_at : undefined;

  const body = fmMatch[2] ?? "";
  const question = extractSection(body, "Question");
  const answer = extractSection(body, "Answer");

  if (expectedQueue === "asking") {
    if (kind !== "prompt") {
      throw new ClarifyValidationError("invalid_kind", "asking must be kind: prompt");
    }
    if (answered_at) {
      throw new ClarifyValidationError("invalid_answered_at", "asking must not have answered_at");
    }
    if (!question || !question.trim()) {
      throw new ClarifyValidationError("missing_question", "asking requires ## Question");
    }
    assertUtf8WithinLimit("question", question);
    if (answer != null && answer.trim()) {
      throw new ClarifyValidationError("unexpected_answer", "asking must not have ## Answer");
    }
    return {
      fm: { id, kind, created_at, source_dream_run_id, related_nodes },
      question: question.trim(),
      answer: null,
    };
  }

  // pending / history
  if (!answered_at) {
    throw new ClarifyValidationError("missing_answered_at", "pending/history requires answered_at");
  }
  if (!answer || !answer.trim()) {
    throw new ClarifyValidationError("missing_answer", "pending/history requires ## Answer");
  }
  assertUtf8WithinLimit("answer", answer);
  if (kind === "aside") {
    if (question != null && question.trim()) {
      throw new ClarifyValidationError("unexpected_question", "aside must omit ## Question");
    }
    return {
      fm: { id, kind, created_at, answered_at, source_dream_run_id, related_nodes },
      question: null,
      answer: answer.trim(),
    };
  }
  if (!question || !question.trim()) {
    throw new ClarifyValidationError("missing_question", "prompt pending requires ## Question");
  }
  assertUtf8WithinLimit("question", question);
  return {
    fm: { id, kind, created_at, answered_at, source_dream_run_id, related_nodes },
    question: question.trim(),
    answer: answer.trim(),
  };
}

async function listMdStems(queue: ClarifyQueue): Promise<string[]> {
  await ensureClarifyDirs();
  const dir = clarifyQueueDir(queue);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.slice(0, -3));
}

export async function listAskingIds(): Promise<string[]> {
  return listMdStems("asking");
}

export async function listPendingIds(): Promise<string[]> {
  return listMdStems("pending");
}

export async function listHistoryIds(): Promise<string[]> {
  return listMdStems("history");
}

export async function readAskingItem(id: string): Promise<ClarifyAskingItem | null> {
  if (!isValidClarifyId(id)) return null;
  const path = clarifyAbs("asking", id);
  if (!(await exists(path))) return null;
  const parsed = parseClarifyMarkdown(await readFile(path, "utf8"), "asking");
  if (parsed.fm.id !== id) {
    throw new ClarifyValidationError("id_mismatch", `frontmatter id ${parsed.fm.id} != filename ${id}`);
  }
  return {
    id,
    kind: "prompt",
    created_at: parsed.fm.created_at,
    source_dream_run_id: parsed.fm.source_dream_run_id,
    related_nodes: parsed.fm.related_nodes,
    question: parsed.question!,
  };
}

export async function readPendingItem(id: string): Promise<ClarifyPendingItem | null> {
  if (!isValidClarifyId(id)) return null;
  const path = clarifyAbs("pending", id);
  if (!(await exists(path))) return null;
  const parsed = parseClarifyMarkdown(await readFile(path, "utf8"), "pending");
  if (parsed.fm.id !== id) {
    throw new ClarifyValidationError("id_mismatch", `frontmatter id ${parsed.fm.id} != filename ${id}`);
  }
  return {
    id,
    kind: parsed.fm.kind,
    created_at: parsed.fm.created_at,
    answered_at: parsed.fm.answered_at!,
    source_dream_run_id: parsed.fm.source_dream_run_id,
    related_nodes: parsed.fm.related_nodes,
    question: parsed.question,
    answer: parsed.answer!,
  };
}

/** List asking items oldest → newest by created_at. */
export async function listAskingItems(): Promise<ClarifyAskingItem[]> {
  const ids = await listAskingIds();
  const items: ClarifyAskingItem[] = [];
  for (const id of ids) {
    try {
      const item = await readAskingItem(id);
      if (item) items.push(item);
    } catch (e) {
      logError("clarify: skip corrupt asking file", e, { id });
    }
  }
  items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return items;
}

/** List all pending items (any order stable by created_at). */
export async function listPendingItems(): Promise<ClarifyPendingItem[]> {
  const ids = await listPendingIds();
  const items: ClarifyPendingItem[] = [];
  for (const id of ids) {
    try {
      const item = await readPendingItem(id);
      if (item) items.push(item);
    } catch (e) {
      logError("clarify: skip corrupt pending file", e, { id });
    }
  }
  items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return items;
}

/** Write a new asking file (generate path). Caller holds clarify write lock. */
export async function writeAskingFile(opts: {
  id: string;
  question: string;
  source_dream_run_id: string;
  related_nodes?: string[];
  created_at?: string;
}): Promise<void> {
  if (!isValidClarifyId(opts.id)) {
    throw new ClarifyValidationError("invalid_id", "invalid clarify id");
  }
  const question = opts.question.trim();
  if (!question) {
    throw new ClarifyValidationError("missing_question", "question required");
  }
  assertUtf8WithinLimit("question", question);
  const related_nodes = normalizeRelatedNodes(opts.related_nodes ?? []);
  await ensureClarifyDirs();
  const md = renderClarifyMarkdown({
    fm: {
      id: opts.id,
      kind: "prompt",
      created_at: opts.created_at ?? nowIso(),
      source_dream_run_id: opts.source_dream_run_id,
      related_nodes,
    },
    question,
  });
  await writeFile(clarifyAbs("asking", opts.id), md, "utf8");
}

/** True-delete asking file; missing → no-op. Returns whether a file was deleted. */
export async function deleteAskingFile(id: string): Promise<boolean> {
  if (!isValidClarifyId(id)) return false;
  const path = clarifyAbs("asking", id);
  if (!(await exists(path))) return false;
  await rm(path, { force: true });
  return true;
}

/**
 * Submit: move asking → pending with answer.
 * Caller must hold clarify write lock. Missing asking → null.
 */
export async function submitAsking(id: string, answerRaw: string): Promise<{ id: string } | null> {
  if (!isValidClarifyId(id)) return null;
  const answer = answerRaw.trim();
  if (!answer) {
    throw new ClarifyValidationError("missing_answer", "answer is required");
  }
  assertUtf8WithinLimit("answer", answer);
  const askingPath = clarifyAbs("asking", id);
  if (!(await exists(askingPath))) return null;
  const parsed = parseClarifyMarkdown(await readFile(askingPath, "utf8"), "asking");
  const answered_at = nowIso();
  const md = renderClarifyMarkdown({
    fm: {
      ...parsed.fm,
      answered_at,
    },
    question: parsed.question,
    answer,
  });
  await ensureClarifyDirs();
  await writeFile(clarifyAbs("pending", id), md, "utf8");
  await rm(askingPath, { force: true });
  return { id };
}

/** Write aside into pending. Caller holds clarify write lock. */
export async function writeAside(raw: string): Promise<{ id: string }> {
  const answer = raw.trim();
  if (!answer) {
    throw new ClarifyValidationError("missing_raw", "raw is required");
  }
  assertUtf8WithinLimit("raw", answer);
  const id = crypto.randomUUID();
  const created_at = nowIso();
  const md = renderClarifyMarkdown({
    fm: {
      id,
      kind: "aside",
      created_at,
      answered_at: created_at,
      source_dream_run_id: null,
      related_nodes: [],
    },
    answer,
  });
  await ensureClarifyDirs();
  await writeFile(clarifyAbs("pending", id), md, "utf8");
  return { id };
}

/**
 * Move pending ids that still exist into history/.
 * Returns relative paths moved (for git staging).
 */
export async function archivePendingToHistory(ids: string[]): Promise<string[]> {
  await ensureClarifyDirs();
  const moved: string[] = [];
  for (const id of ids) {
    if (!isValidClarifyId(id)) continue;
    const from = clarifyAbs("pending", id);
    if (!(await exists(from))) continue;
    const to = clarifyAbs("history", id);
    await rename(from, to);
    moved.push(clarifyRel("history", id));
    // Also stage deletion from pending path by adding parent dirs via git add
    moved.push(clarifyRel("pending", id)); // git add will notice deletion if we add clarify/
  }
  return moved;
}

/** Delete asking files whose source_dream_run_id is in the given set. Returns deleted ids. */
export async function deleteAskingBySourceRunIds(runIds: Iterable<string>): Promise<string[]> {
  const set = new Set([...runIds].filter(Boolean));
  if (set.size === 0) return [];
  const deleted: string[] = [];
  for (const item of await listAskingItems()) {
    if (item.source_dream_run_id && set.has(item.source_dream_run_id)) {
      if (await deleteAskingFile(item.id)) deleted.push(item.id);
    }
  }
  return deleted;
}

/**
 * After generate writes new asking files, prune to ≤ CAP.
 * Pruned = true delete (not history). Prefer deleting oldest first among
 * files that are NOT from the current dream_run_id, then oldest of current.
 */
export async function pruneAskingToCap(
  preferKeepSourceRunId?: string,
): Promise<string[]> {
  const items = await listAskingItems();
  if (items.length <= CLARIFY_ASKING_CAP) return [];
  const excess = items.length - CLARIFY_ASKING_CAP;
  const victims: ClarifyAskingItem[] = [];
  const others = items.filter((i) => i.source_dream_run_id !== preferKeepSourceRunId);
  const same = items.filter((i) => i.source_dream_run_id === preferKeepSourceRunId);
  for (const pool of [others, same]) {
    for (const it of pool) {
      if (victims.length >= excess) break;
      victims.push(it);
    }
    if (victims.length >= excess) break;
  }
  const deleted: string[] = [];
  for (const v of victims) {
    if (await deleteAskingFile(v.id)) deleted.push(v.id);
  }
  if (deleted.length) {
    logInfo("clarify: pruned asking over cap", {
      deleted: deleted.length,
      cap: CLARIFY_ASKING_CAP,
    });
  }
  return deleted;
}

/** Git-commit clarify path changes under memories/clarify. */
export async function commitClarifyPaths(
  message: string,
  extraRels: string[] = [],
): Promise<boolean> {
  const paths = ["memories/clarify", ...extraRels];
  try {
    return await stageAndCommitPaths(paths, message);
  } catch (e) {
    logError("clarify git commit failed", e, { message });
    throw e;
  }
}
