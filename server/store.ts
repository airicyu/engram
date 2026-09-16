import { mkdir, readdir, readFile, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  chainDir,
  chainFile,
  defaultPiModel,
  nodeFile,
  nodesDir,
  poolArchivedPath,
  poolPendingPath,
  storeDir,
  workspacePath,
  type ChainLevel,
} from "./paths.ts";

export type EventRow = {
  id: string;
  ts: string;
  raw: string;
  note?: string;
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
  const ids = files.map((f) => idFromChainPath(level, f));
  return [...new Set(ids)].sort().reverse();
}

export async function readChain(level: ChainLevel, id: string): Promise<{ id: string; present: boolean; markdown: string | null; path: string | null }> {
  if (level === "week") {
    const files = await walkMd(join(chainDir(), "weeks"));
    const hit = files.find((f) => f.endsWith(`/${id}.md`));
    if (!hit) return { id, present: false, markdown: null, path: null };
    const markdown = await readFile(hit, "utf8");
    return { id, present: true, markdown, path: hit };
  }
  const path = chainFile(level, id);
  if (!path) return { id, present: false, markdown: null, path: null };
  try {
    const markdown = await readFile(path, "utf8");
    return { id, present: true, markdown, path };
  } catch {
    return { id, present: false, markdown: null, path };
  }
}

export async function listNodes(): Promise<{ id: string; title: string }[]> {
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
      const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
      out.push({ id, title });
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
    return { id, present: true, markdown };
  } catch {
    return { id, present: false, markdown: null };
  }
}

export { storeDir };
