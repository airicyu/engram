/** Future-sight zone files (`upcoming.md` / `longTerm.md`), aligned with Engram 0.40+. */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { memoriesDir, workspacePath } from "./paths.ts";
import { stampInTimezone } from "./store.ts";

export type FutureSightZone = "upcoming" | "longTerm";

export type FutureSightAnchor = {
  id: string;
  anchor_start: string;
  anchor_end: string;
  content: string;
};

export type FutureSightListedAnchor = FutureSightAnchor & { zone: FutureSightZone };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDayId(s: string): boolean {
  return DAY_RE.test(s);
}

export function isValidFutureSightId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

export function addCalendarDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type FutureSightSettings = {
  windowDays: number;
  upcomingDays: number;
};

const DEFAULT_WINDOW = 365;
const DEFAULT_UPCOMING = 30;

function parsePositiveInt(v: string | undefined, fallback: number): number {
  if (!v?.trim()) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function storeRootFromVault(vaultRoot: string): string {
  return join(vaultRoot, "..");
}

async function readWorkspaceText(storeRoot?: string): Promise<string | null> {
  const path = storeRoot ? join(storeRoot, "workspace.yaml") : workspacePath();
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function readFutureSightSettings(storeRoot?: string): Promise<FutureSightSettings> {
  const windowEnv = process.env.ENGRAM_LITE_FUTURE_SIGHT_WINDOW_DAYS?.trim();
  const upcomingEnv = process.env.ENGRAM_LITE_FUTURE_SIGHT_UPCOMING_DAYS?.trim();
  let windowDays = parsePositiveInt(windowEnv, DEFAULT_WINDOW);
  let upcomingDays = parsePositiveInt(upcomingEnv, DEFAULT_UPCOMING);
  const text = await readWorkspaceText(storeRoot);
  if (text) {
    const w = text.match(/^future_sight_window_days:\s*(\d+)\s*$/m)?.[1];
    const u = text.match(/^future_sight_upcoming_days:\s*(\d+)\s*$/m)?.[1];
    if (w) windowDays = parsePositiveInt(w, windowDays);
    if (u) upcomingDays = parsePositiveInt(u, upcomingDays);
  }
  return { windowDays, upcomingDays };
}

async function timezoneForVault(vaultRoot: string): Promise<string> {
  const text = await readWorkspaceText(storeRootFromVault(vaultRoot));
  if (!text) return process.env.ENGRAM_LITE_TZ ?? "Asia/Hong_Kong";
  return text.match(/^timezone:\s*(.+)$/m)?.[1]?.trim() ?? "Asia/Hong_Kong";
}

export function futureSightDir(vaultRoot = memoriesDir()) {
  return join(vaultRoot, "future-sight");
}

function zonePath(zone: FutureSightZone, vaultRoot = memoriesDir()) {
  return join(futureSightDir(vaultRoot), `${zone}.md`);
}

export function emptyZoneMarkdown(zone: FutureSightZone, updatedAt: string): string {
  return `---\nzone: ${zone}\nupdated_at: ${updatedAt}\n---\n`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseFenceYaml(yaml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function parseItemFields(meta: Record<string, string>, id: string): FutureSightAnchor {
  if (!isValidFutureSightId(id)) throw new Error(`invalid future-sight id: ${id}`);
  const anchor_start = meta.anchor_start ?? "";
  const anchor_end = meta.anchor_end ?? "";
  if (!isValidDayId(anchor_start) || !isValidDayId(anchor_end)) {
    throw new Error(`invalid anchor dates for ${id}`);
  }
  if (anchor_start > anchor_end) throw new Error(`anchor_start > anchor_end for ${id}`);
  return { id, anchor_start, anchor_end, content: "" };
}

export function parseZoneFile(text: string, expectedZone?: FutureSightZone): FutureSightAnchor[] {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) throw new Error("future-sight zone file missing YAML frontmatter");
  const zoneLine = fm[1]!.match(/^zone:\s*(\S+)/m)?.[1];
  if (expectedZone && zoneLine !== expectedZone) {
    throw new Error(`zone frontmatter mismatch: expected ${expectedZone}, got ${zoneLine}`);
  }

  const body = fm[2] ?? "";
  const anchors: FutureSightAnchor[] = [];
  const headingRe = /^##\s+(\S+)\s*$/gm;
  const matches = [...body.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const id = matches[i]![1]!;
    const start = matches[i]!.index! + matches[i]![0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : body.length;
    const chunk = body.slice(start, end).trim();
    const fence = chunk.match(/^```yaml\n([\s\S]*?)\n```\n?([\s\S]*)$/);
    if (!fence) throw new Error(`future-sight item ${id}: missing yaml fence`);
    const meta = parseFenceYaml(fence[1]!);
    const a = parseItemFields(meta, id);
    a.content = fence[2]!.trim();
    anchors.push(a);
  }
  return anchors;
}

export function sortAnchors(anchors: FutureSightAnchor[]): FutureSightAnchor[] {
  return [...anchors].sort(
    (a, b) =>
      a.anchor_start.localeCompare(b.anchor_start) ||
      a.anchor_end.localeCompare(b.anchor_end) ||
      a.id.localeCompare(b.id),
  );
}

function renderItem(a: FutureSightAnchor): string {
  const yaml = `anchor_start: ${a.anchor_start}\nanchor_end: ${a.anchor_end}`;
  const body = a.content.trim();
  return `## ${a.id}\n\`\`\`yaml\n${yaml}\n\`\`\`\n\n${body}\n`;
}

export function renderZoneFile(zone: FutureSightZone, anchors: FutureSightAnchor[], updatedAt: string): string {
  const sorted = sortAnchors(anchors);
  const fm = `zone: ${zone}\nupdated_at: ${updatedAt}`;
  if (sorted.length === 0) return `---\n${fm}\n---\n`;
  return `---\n${fm}\n---\n\n${sorted.map(renderItem).join("\n")}`;
}

async function readZoneAnchors(zone: FutureSightZone, vaultRoot: string): Promise<FutureSightAnchor[]> {
  const path = zonePath(zone, vaultRoot);
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
  vaultRoot: string,
  updatedAt: string,
): Promise<void> {
  await mkdir(futureSightDir(vaultRoot), { recursive: true });
  await writeFile(zonePath(zone, vaultRoot), renderZoneFile(zone, anchors, updatedAt), "utf8");
}

export async function ensureFutureSightFiles(vaultRoot = memoriesDir()): Promise<void> {
  const tz = await timezoneForVault(vaultRoot);
  const { ts } = stampInTimezone(tz);
  await mkdir(futureSightDir(vaultRoot), { recursive: true });
  for (const zone of ["upcoming", "longTerm"] as const) {
    const path = zonePath(zone, vaultRoot);
    if (!(await exists(path))) {
      await writeFile(path, emptyZoneMarkdown(zone, ts), "utf8");
    }
  }
}

export async function listFutureSightAnchors(vaultRoot = memoriesDir()): Promise<FutureSightListedAnchor[]> {
  const upcoming = sortAnchors(await readZoneAnchors("upcoming", vaultRoot)).map((a) => ({
    ...a,
    zone: "upcoming" as const,
  }));
  const longTerm = sortAnchors(await readZoneAnchors("longTerm", vaultRoot)).map((a) => ({
    ...a,
    zone: "longTerm" as const,
  }));
  return [...upcoming, ...longTerm];
}

export async function countFutureSightAnchors(vaultRoot = memoriesDir()) {
  const upcoming = (await readZoneAnchors("upcoming", vaultRoot)).length;
  const longTerm = (await readZoneAnchors("longTerm", vaultRoot)).length;
  return { total: upcoming + longTerm, upcoming, longTerm };
}

export type SweepFutureSightResult = {
  anchors: FutureSightListedAnchor[];
  swept_expired: string[];
  changed: boolean;
  future_sight_window_days: number;
  future_sight_upcoming_days: number;
};

/**
 * Expire-only maintain (GET contract): drop anchors with anchor_end < today;
 * append synthetic events to pool pending. Does not rebucket upcoming↔longTerm.
 */
export async function sweepFutureSight(
  appendExpiredToPool: (raw: string) => Promise<void>,
  vaultRoot = memoriesDir(),
): Promise<SweepFutureSightResult> {
  await ensureFutureSightFiles(vaultRoot);
  const storeRoot = storeRootFromVault(vaultRoot);
  const settings = await readFutureSightSettings(storeRoot);
  const tz = await timezoneForVault(vaultRoot);
  const { ts } = stampInTimezone(tz);
  const today = ts.slice(0, 10);

  const beforeUpcoming = await readZoneAnchors("upcoming", vaultRoot);
  const beforeLongTerm = await readZoneAnchors("longTerm", vaultRoot);
  const swept: string[] = [];
  const keepUpcoming: FutureSightAnchor[] = [];
  const keepLongTerm: FutureSightAnchor[] = [];

  for (const a of beforeUpcoming) {
    if (a.anchor_end < today) {
      swept.push(a.id);
      const raw =
        `Future-sight expired: ${a.id} (${a.anchor_start}→${a.anchor_end}). ` +
        `${a.content.trim().slice(0, 400)}`;
      await appendExpiredToPool(raw);
    } else keepUpcoming.push(a);
  }
  for (const a of beforeLongTerm) {
    if (a.anchor_end < today) {
      swept.push(a.id);
      const raw =
        `Future-sight expired: ${a.id} (${a.anchor_start}→${a.anchor_end}). ` +
        `${a.content.trim().slice(0, 400)}`;
      await appendExpiredToPool(raw);
    } else keepLongTerm.push(a);
  }

  const changed =
    swept.length > 0 ||
    beforeUpcoming.length !== keepUpcoming.length ||
    beforeLongTerm.length !== keepLongTerm.length;

  if (changed) {
    await writeZoneAnchors("upcoming", keepUpcoming, vaultRoot, ts);
    await writeZoneAnchors("longTerm", keepLongTerm, vaultRoot, ts);
  }

  const anchors = await listFutureSightAnchors(vaultRoot);
  return {
    anchors,
    swept_expired: swept,
    changed,
    future_sight_window_days: settings.windowDays,
    future_sight_upcoming_days: settings.upcomingDays,
  };
}
