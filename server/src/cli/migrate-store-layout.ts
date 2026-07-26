/**
 * Migrate ENGRAM_HOME to 0.14 store layout (memory/ + tmp/ + dream/candidates).
 *
 * Usage:
 *   ENGRAM_HOME=/path/to/store bun run store:migrate-layout
 *
 * Idempotent. Refuses if a target already exists with different content.
 * Discard pending drafts before migrating (old draft relative paths are not rewritten).
 */

import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "../config";
import { ensureEngramHome } from "../store/home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isEmptyDir(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length === 0;
  } catch {
    return true;
  }
}

/** Move src → dest. Same-size file conflict → remove src (skip). Different → throw. */
async function movePath(
  src: string,
  dest: string,
  stats: { moved: number; skipped: number; removed: number },
): Promise<void> {
  if (!(await exists(src))) return;

  if (await exists(dest)) {
    const [ss, ds] = await Promise.all([stat(src), stat(dest)]);
    if (ss.isFile() && ds.isFile() && ss.size === ds.size) {
      await rm(src, { force: true });
      stats.skipped++;
      console.log(`skip (dest exists) ${src} → ${dest}`);
      return;
    }
    if (ss.isDirectory() && ds.isDirectory()) {
      // Merge: move children
      const kids = await readdir(src);
      for (const name of kids) {
        await movePath(join(src, name), join(dest, name), stats);
      }
      if (await isEmptyDir(src)) {
        await rm(src, { recursive: true, force: true });
        stats.removed++;
      }
      return;
    }
    throw new Error(`refusing to overwrite existing ${dest} (differs from ${src})`);
  }

  await mkdir(dirname(dest), { recursive: true });
  await rename(src, dest);
  stats.moved++;
  console.log(`moved ${src} → ${dest}`);
}

async function removeIfExists(path: string, stats: { removed: number }, label: string): Promise<void> {
  if (!(await exists(path))) return;
  await rm(path, { recursive: true, force: true });
  stats.removed++;
  console.log(`removed ${label}: ${path}`);
}

async function migrateStoreLayout(home: string): Promise<{
  moved: number;
  skipped: number;
  removed: number;
}> {
  const stats = { moved: 0, skipped: 0, removed: 0 };
  const p = (...parts: string[]) => join(home, ...parts);

  // Directory / file moves (old → new)
  await movePath(p("log", "events.jsonl"), p("memory", "activities", "events.jsonl"), stats);
  await movePath(p("short-term-memory"), p("memory", "short-term-memory"), stats);
  await movePath(p("memory-chain"), p("memory", "memory-chain"), stats);
  await movePath(p("nodes"), p("memory", "nodes"), stats);
  await movePath(p("future-sight"), p("memory", "future-sight"), stats);
  await movePath(
    p("candidates", "attribution.yaml"),
    p("dream", "candidates", "attribution.yaml"),
    stats,
  );
  await movePath(p("memory", "ask"), p("tmp", "ask"), stats);
  await movePath(p("meta", "clock.json"), p("tmp", "clock.json"), stats);
  await movePath(p("replay-cursor.log"), p("log", "replay-cursor.log"), stats);

  // Junk / obsolete
  await removeIfExists(p("meta.yaml"), stats, "meta.yaml");
  await removeIfExists(p("meta"), stats, "meta/");
  await removeIfExists(p("archive"), stats, "archive/");
  await removeIfExists(p("dream", "reviews"), stats, "dream/reviews/");
  await removeIfExists(p("dream", "dead-letter-archive"), stats, "dream/dead-letter-archive/");
  await removeIfExists(p("dream", "applied.yaml"), stats, "dream/applied.yaml");
  await removeIfExists(p("candidates", "nodes.yaml"), stats, "candidates/nodes.yaml");
  await removeIfExists(p("candidates"), stats, "candidates/");

  // Empty old log/ if only events were moved and nothing else remains
  if (await exists(p("log")) && (await isEmptyDir(p("log")))) {
    // keep log/ only if we moved replay-cursor into it — then not empty
    await removeIfExists(p("log"), stats, "empty log/");
  }

  return stats;
}

async function main() {
  const home = config.engramHome;
  console.log(`migrating store layout under ${home}`);
  console.log("(discard pending drafts before migrate if any)");
  const { moved, skipped, removed } = await migrateStoreLayout(home);
  await ensureEngramHome();
  console.log(`done: moved=${moved} skipped=${skipped} removed=${removed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
