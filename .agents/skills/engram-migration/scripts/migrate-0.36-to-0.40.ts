/**
 * Mechanical Engram store migrate: future-sight hot/later → upcoming/longTerm (→ 0.40.0).
 *
 * Usage (offline — server need not be running):
 *   bun ./scripts/migrate-0.36-to-0.40.ts /abs/path/to/store
 *
 * Admits store_version major.minor in 0.36–0.39 (0.36 dual-zone layout with hot/later).
 * Also rewrites if stamped 0.40+ but legacy hot.md／later.md／hot_days key still present.
 * Does NOT backup (caller／skill must). Does NOT discard pending dreams.
 */

import { access, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";

const TARGET_STORE_VERSION = "0.40.0";

const RENAMES = [
  { from: "hot.md", to: "upcoming.md", oldZone: "hot", newZone: "upcoming" },
  { from: "later.md", to: "longTerm.md", oldZone: "later", newZone: "longTerm" },
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

/** True if major.minor ∈ 0.36–0.39. */
function isAdmittedFrom(version: string | null): boolean {
  if (!version) return true;
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  if (mm.major !== 0) return false;
  return mm.minor >= 36 && mm.minor <= 39;
}

function isAtLeastTarget(version: string | null): boolean {
  if (!version) return false;
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  return mm.major > 0 || (mm.major === 0 && mm.minor >= 40);
}

function rewriteZoneFrontmatter(text: string, oldZone: string, newZone: string): string {
  return text.replace(new RegExp(`^zone:\\s*${oldZone}\\s*$`, "m"), `zone: ${newZone}`);
}

async function hasLegacyFutureSight(storeDir: string, ws: Record<string, unknown>): Promise<boolean> {
  if ("future_sight_hot_days" in ws) return true;
  const liveDir = join(storeDir, "memories", "future-sight");
  if (await exists(join(liveDir, "hot.md"))) return true;
  if (await exists(join(liveDir, "later.md"))) return true;
  return false;
}

async function migrateZoneDir(dir: string): Promise<string[]> {
  const changed: string[] = [];
  if (!(await exists(dir))) return changed;
  for (const { from, to, oldZone, newZone } of RENAMES) {
    const fromP = join(dir, from);
    const toP = join(dir, to);
    if (await exists(fromP)) {
      const text = rewriteZoneFrontmatter(await readFile(fromP, "utf8"), oldZone, newZone);
      await writeFile(toP, text, "utf8");
      changed.push(toP);
      if (fromP !== toP) {
        await rm(fromP);
        changed.push(fromP);
      }
    } else if (await exists(toP)) {
      const text = await readFile(toP, "utf8");
      const next = rewriteZoneFrontmatter(text, oldZone, newZone);
      if (next !== text) {
        await writeFile(toP, next, "utf8");
        changed.push(toP);
      }
    }
  }
  return changed;
}

async function main() {
  const storeDir = resolve(process.argv[2] ?? "");
  if (!storeDir) {
    console.error("usage: bun ./scripts/migrate-0.36-to-0.40.ts /abs/path/to/store");
    process.exit(1);
  }

  const wsPath = join(storeDir, "engram.workspace.yaml");
  if (!(await exists(wsPath))) {
    console.error(`missing ${wsPath}`);
    process.exit(1);
  }

  const raw = await readFile(wsPath, "utf8");
  const parsed = parseYaml(raw);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error("engram.workspace.yaml must be a mapping");
    process.exit(1);
  }
  const ws = parsed as Record<string, unknown>;
  const ver = parseStoreVersion(ws.store_version);
  const legacy = await hasLegacyFutureSight(storeDir, ws);

  if (isAtLeastTarget(ver) && !legacy) {
    console.log(`already at structure >= 0.40 (store_version=${ver}); nothing to do`);
    return;
  }
  if (!isAdmittedFrom(ver) && !(isAtLeastTarget(ver) && legacy)) {
    console.error(`store_version ${JSON.stringify(ver)} not in 0.36–0.39; refuse`);
    process.exit(1);
  }

  const liveDir = join(storeDir, "memories", "future-sight");
  await migrateZoneDir(liveDir);

  const draftRoot = join(storeDir, "dreams", "draft");
  if (await exists(draftRoot)) {
    for (const name of await readdir(draftRoot)) {
      await migrateZoneDir(join(draftRoot, name, "memories", "future-sight"));
    }
  }

  if ("future_sight_hot_days" in ws) {
    if (!("future_sight_upcoming_days" in ws)) {
      ws.future_sight_upcoming_days = ws.future_sight_hot_days;
    }
    delete ws.future_sight_hot_days;
  }
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
      "memories/future-sight",
      "dreams/draft",
      "engram.workspace.yaml",
    ]);
    const st = await git(storeDir, ["diff", "--cached", "--name-only"]);
    if (st.stdout.trim()) {
      const c = await git(storeDir, [
        "commit",
        "-m",
        "engram: migrate store →0.40 future-sight upcoming/longTerm",
      ]);
      if (c.code !== 0) console.warn("git commit failed:", c.stderr);
      else console.log("git commit ok");
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
