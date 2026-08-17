/**
 * Mechanical Engram store migrate: drop leftover chain indexes + STM derived files (→ 0.36.0).
 *
 * Usage (offline — server need not be running):
 *   bun ./scripts/migrate-0.28-to-0.36.ts /abs/path/to/store
 *
 * Admits store_version major.minor in 0.28–0.35 (0.28 node-main layout).
 * Does NOT backup (caller／skill must). Does NOT discard pending dreams.
 */

import { access, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";

const TARGET_STORE_VERSION = "0.36.0";

const LEGACY_INITIALIZED = [
  "initialized_weeks.yaml",
  "initialized_months.yaml",
  "initialized_years.yaml",
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

function parseStoreVersion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const m = version.match(/^(\d+)\.(\d+)\.\d+$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

/** True if major.minor ∈ 0.28–0.35. */
function isAdmittedFrom(version: string | null): boolean {
  if (!version) return true;
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  if (mm.major !== 0) return false;
  return mm.minor >= 28 && mm.minor <= 35;
}

function isAlreadyTarget(version: string | null): boolean {
  if (!version) return false;
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  return mm.major > 0 || (mm.major === 0 && mm.minor >= 36);
}

async function dropInitializedYaml(storeDir: string): Promise<string[]> {
  const removed: string[] = [];
  const chainDir = join(storeDir, "memories", "chain");
  for (const name of LEGACY_INITIALIZED) {
    const p = join(chainDir, name);
    if (!(await exists(p))) continue;
    await rm(p, { force: true });
    removed.push(`memories/chain/${name}`);
  }
  return removed;
}

interface EventRow {
  id: string;
  ts: string;
  raw: string;
}

async function readEvents(storeDir: string): Promise<EventRow[]> {
  const p = join(storeDir, "memories", "activities", "events.jsonl");
  if (!(await exists(p))) return [];
  const text = await readFile(p, "utf8");
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRow);
}

/** If pool is empty and summary.md still lists event ids, copy those events into pool. */
async function migrateSummaryToPool(storeDir: string): Promise<boolean> {
  const stm = join(storeDir, "memories", "short-term-memory");
  const poolPath = join(stm, "pool.jsonl");
  const summaryPath = join(stm, "summary.md");
  const legacySummary = join(stm, "today-summary.md");

  let poolText = "";
  if (await exists(poolPath)) {
    poolText = await readFile(poolPath, "utf8");
  }
  if (poolText.trim()) return false;

  let summaryFile = summaryPath;
  if (!(await exists(summaryPath)) && (await exists(legacySummary))) {
    summaryFile = legacySummary;
  }
  if (!(await exists(summaryFile))) return false;

  const summary = await readFile(summaryFile, "utf8");
  if (!summary.trim()) return false;

  const ids = new Set<string>();
  for (const m of summary.matchAll(/\(([eE]\d+)\)/g)) {
    ids.add(m[1]);
  }
  if (ids.size === 0) return false;

  const events = await readEvents(storeDir);
  const byId = new Map(events.map((e) => [e.id, e]));
  const entries: EventRow[] = [];
  for (const id of ids) {
    const ev = byId.get(id);
    if (ev) entries.push({ id: ev.id, ts: ev.ts, raw: ev.raw });
  }
  if (entries.length === 0) return false;

  await writeFile(poolPath, entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  return true;
}

async function dropStmDerived(storeDir: string): Promise<string[]> {
  const removed: string[] = [];
  const stm = join(storeDir, "memories", "short-term-memory");
  for (const name of ["summary.md", "today-summary.md"]) {
    const p = join(stm, name);
    if (!(await exists(p))) continue;
    await rm(p, { force: true });
    removed.push(`memories/short-term-memory/${name}`);
  }
  const nodes = join(stm, "nodes");
  if (await exists(nodes)) {
    await rm(nodes, { recursive: true, force: true });
    removed.push("memories/short-term-memory/nodes/");
  }
  return removed;
}

async function main() {
  const storeArg = process.argv[2];
  if (!storeArg) {
    console.error("Usage: bun migrate-0.28-to-0.36.ts /abs/path/to/store");
    console.error("(offline — Engram server need not be running)");
    process.exit(1);
  }
  const storeDir = resolve(storeArg);
  if (!(await exists(storeDir))) {
    console.error(`store not found: ${storeDir}`);
    process.exit(1);
  }

  const wsPath = join(storeDir, "engram.workspace.yaml");
  let ws: Record<string, unknown> = {};
  if (await exists(wsPath)) {
    const parsed = parseYaml(await readFile(wsPath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      ws = parsed as Record<string, unknown>;
    }
  }
  const fromVer = parseStoreVersion(ws.store_version);

  if (fromVer === TARGET_STORE_VERSION || isAlreadyTarget(fromVer)) {
    console.log(`already store_version ${fromVer}; nothing to do`);
    return;
  }
  if (fromVer && !isAdmittedFrom(fromVer)) {
    console.error(
      `refusing: store_version=${fromVer} not in 0.28.x–0.35.x. Run prior hops first (e.g. migrate-0.19-to-0.28).`,
    );
    process.exit(1);
  }

  console.log("migrate-0.28-to-0.36: offline hop (server need not be running)");

  const yamlDropped = await dropInitializedYaml(storeDir);
  console.log(
    yamlDropped.length
      ? `dropped chain indexes: ${yamlDropped.join(", ")}`
      : "dropped chain indexes: (none)",
  );

  const filledPool = await migrateSummaryToPool(storeDir);
  if (filledPool) console.log("filled empty pool.jsonl from leftover summary.md");

  const stmDropped = await dropStmDerived(storeDir);
  console.log(
    stmDropped.length
      ? `dropped STM derived: ${stmDropped.join(", ")}`
      : "dropped STM derived: (none)",
  );

  ws.store_version = TARGET_STORE_VERSION;
  await writeFile(
    wsPath,
    `# Engram workspace preferences (per memory store)\n${stringifyYaml(ws)}`,
    "utf8",
  );
  console.log(`store_version → ${TARGET_STORE_VERSION}`);

  if (await exists(join(storeDir, ".git"))) {
    await git(storeDir, [
      "add",
      "-A",
      "--",
      "memories/chain",
      "memories/short-term-memory",
      "engram.workspace.yaml",
    ]);
    const st = await git(storeDir, ["diff", "--cached", "--name-only"]);
    if (st.stdout.trim()) {
      const c = await git(storeDir, [
        "commit",
        "-m",
        "engram: migrate store →0.36 drop initialized_*.yaml and STM derived files",
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
    console.warn("store has no .git — skipped commit");
  }

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
