/**
 * Mechanical Engram store migrate: 0.16 future-sight active/* → 0.17 hot.md／later.md.
 *
 * Usage:
 *   # from this skill directory:
 *   bun ./scripts/migrate-0.16-to-0.17.ts /abs/path/to/store
 *
 * Does NOT backup (caller／skill must backup first).
 * Does NOT replay dreams.
 */

import { access, readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";
import {
  parseLegacyActiveMarkdown,
  assignZone,
  renderZoneFile,
  sortAnchors,
  addCalendarDays,
  type FutureSightAnchor,
} from "../../../../server/src/store/memories/future-sight.ts";

const TARGET_STORE_VERSION = "0.17.0";
const DEFAULT_WINDOW = 90;
const DEFAULT_HOT = 30;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function calendarToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function git(
  storeDir: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", "-C", storeDir, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, stdout, stderr };
}

function readPositiveInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    if (n > 0) return n;
  }
  return fallback;
}

async function loadWorkspace(storeDir: string): Promise<{
  timezone: string;
  windowDays: number;
  hotDays: number;
  raw: Record<string, unknown>;
}> {
  const path = join(storeDir, "engram.workspace.yaml");
  let raw: Record<string, unknown> = {};
  if (await exists(path)) {
    const parsed = parseYaml(await readFile(path, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>;
    }
  }
  const timezone =
    (typeof raw.timezone === "string" && raw.timezone.trim()) ||
    process.env.ENGRAM_TZ?.trim() ||
    "Asia/Hong_Kong";
  const windowDays =
    "future_sight_window_days" in raw
      ? readPositiveInt(raw.future_sight_window_days, DEFAULT_WINDOW)
      : readPositiveInt(process.env.ENGRAM_FUTURE_SIGHT_WINDOW_DAYS, DEFAULT_WINDOW);
  const hotDays =
    "future_sight_hot_days" in raw
      ? readPositiveInt(raw.future_sight_hot_days, DEFAULT_HOT)
      : readPositiveInt(process.env.ENGRAM_FUTURE_SIGHT_HOT_DAYS, DEFAULT_HOT);
  return { timezone, windowDays, hotDays, raw };
}

async function appendExpiryEvent(
  storeDir: string,
  a: FutureSightAnchor,
  reason: "past_anchor_end" | "out_of_window",
): Promise<void> {
  const eventsPath = join(storeDir, "memories/activities/events.jsonl");
  const poolPath = join(storeDir, "memories/short-term-memory/pool.jsonl");
  await mkdir(join(storeDir, "memories/activities"), { recursive: true });
  await mkdir(join(storeDir, "memories/short-term-memory"), { recursive: true });

  let nextId = "e0000000001";
  if (await exists(eventsPath)) {
    const text = await readFile(eventsPath, "utf8");
    const lines = text.split("\n").filter((l) => l.trim());
    const last = lines[lines.length - 1];
    if (last) {
      try {
        const obj = JSON.parse(last) as { id?: string };
        if (typeof obj.id === "string" && /^e\d+$/.test(obj.id)) {
          const n = Number(obj.id.slice(1)) + 1;
          nextId = `e${String(n).padStart(10, "0")}`;
        }
      } catch {
        /* keep default */
      }
    }
  }

  const ts = new Date().toISOString();
  const label = reason === "past_anchor_end" ? "expired" : "out of window";
  const raw =
    `Future-sight ${label} (migrate 0.16→0.17): ${a.id} (${a.anchor_start}→${a.anchor_end}). ` +
    `${a.content.trim().slice(0, 400)}`;
  const event = {
    id: nextId,
    ts,
    source: "system/future_sight_expired",
    raw,
    ingest_meta: {
      future_sight_id: a.id,
      reason,
      anchor_start: a.anchor_start,
      anchor_end: a.anchor_end,
      migrate: "0.16-to-0.17",
    },
  };
  await writeFile(eventsPath, `${(await exists(eventsPath)) ? await readFile(eventsPath, "utf8") : ""}${JSON.stringify(event)}\n`, "utf8");
  const poolEntry = { id: nextId, ts, raw };
  await writeFile(
    poolPath,
    `${(await exists(poolPath)) ? await readFile(poolPath, "utf8") : ""}${JSON.stringify(poolEntry)}\n`,
    "utf8",
  );
}

async function main() {
  const storeArg = process.argv[2];
  if (!storeArg) {
    console.error("Usage: bun migrate-0.16-to-0.17.ts /abs/path/to/ENGRAM_STORE_DIR");
    process.exit(1);
  }
  const storeDir = resolve(storeArg);
  if (!(await exists(storeDir))) {
    console.error(`store not found: ${storeDir}`);
    process.exit(1);
  }

  const { timezone, windowDays, hotDays, raw } = await loadWorkspace(storeDir);
  const T = calendarToday(timezone);
  console.log(`store=${storeDir}`);
  console.log(`T=${T} tz=${timezone} window=${windowDays} hot=${hotDays}`);

  const activeDir = join(storeDir, "memories/future-sight/active");
  const hotPath = join(storeDir, "memories/future-sight/hot.md");
  const laterPath = join(storeDir, "memories/future-sight/later.md");

  const already =
    (await exists(hotPath)) &&
    (await exists(laterPath)) &&
    !(await exists(activeDir)) &&
    raw.store_version === TARGET_STORE_VERSION;
  if (already) {
    console.log("already 0.17 shape; nothing to do");
    return;
  }

  const anchors: FutureSightAnchor[] = [];
  if (await exists(activeDir)) {
    const names = await readdir(activeDir);
    for (const name of names) {
      if (!name.endsWith(".md")) continue;
      const id = name.slice(0, -3);
      const text = await readFile(join(activeDir, name), "utf8");
      try {
        anchors.push(parseLegacyActiveMarkdown(text, id));
      } catch (e) {
        console.warn(`skip corrupt ${name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } else {
    console.log("no active/ directory — will ensure empty zone files + stamp version");
  }

  const hot: FutureSightAnchor[] = [];
  const later: FutureSightAnchor[] = [];
  for (const a of anchors) {
    const bucket = assignZone(a, T, hotDays, windowDays);
    if (bucket === "expired") {
      await appendExpiryEvent(storeDir, a, "past_anchor_end");
      console.log(`expired drop ${a.id}`);
      continue;
    }
    if (bucket === "out_of_window") {
      await appendExpiryEvent(storeDir, a, "out_of_window");
      console.log(`out_of_window drop ${a.id}`);
      continue;
    }
    if (bucket === "hot") hot.push(a);
    else later.push(a);
  }

  await mkdir(join(storeDir, "memories/future-sight"), { recursive: true });
  await writeFile(hotPath, renderZoneFile("hot", sortAnchors(hot)), "utf8");
  await writeFile(laterPath, renderZoneFile("later", sortAnchors(later)), "utf8");
  console.log(`wrote hot=${hot.length} later=${later.length}`);

  if (await exists(activeDir)) {
    await rm(activeDir, { recursive: true, force: true });
    console.log("removed active/");
  }

  const nextWs = { ...raw, store_version: TARGET_STORE_VERSION };
  await writeFile(
    join(storeDir, "engram.workspace.yaml"),
    `# Engram workspace preferences (per memory store)\n${stringifyYaml(nextWs)}`,
    "utf8",
  );
  console.log(`store_version → ${TARGET_STORE_VERSION}`);

  if (await exists(join(storeDir, ".git"))) {
    await git(storeDir, [
      "add",
      "--",
      "memories/future-sight",
      "memories/activities/events.jsonl",
      "memories/short-term-memory",
      "engram.workspace.yaml",
    ]);
    const st = await git(storeDir, ["diff", "--cached", "--name-only"]);
    if (st.stdout.trim()) {
      const c = await git(storeDir, [
        "commit",
        "-m",
        "engram: migrate store 0.16 → 0.17 (future-sight hot/later)",
      ]);
      if (c.code !== 0) {
        console.warn("git commit failed:", c.stderr);
      } else {
        console.log("git commit ok");
      }
    } else {
      console.log("git: nothing to commit");
    }
  } else {
    console.warn("no .git in store — skipped commit");
  }

  console.log("done");
  console.log(`window_last=${addCalendarDays(T, windowDays)} hot_last=${addCalendarDays(T, hotDays)}`);
}

await main();
