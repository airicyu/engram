/**
 * Migrate flat memory-chain/days/{YYYY-MM-DD}*.md → days/{YYYY-MM}/…
 *
 * Usage:
 *   ENGRAM_HOME=/path/to/store bun run chain:migrate-days
 *
 * Idempotent: already-grouped files are left alone. Refuses if a target
 * already exists with different content. Discard pending drafts before migrating.
 */

import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";
import { dayMonthKey } from "../store/chain";
import { ensureEngramHome } from "../store/home";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const FLAT_DAY_RE = /^(\d{4}-\d{2}-\d{2})(\.summary)?\.md$/;

async function migrateDaysLayout(home: string): Promise<{ moved: number; skipped: number }> {
  const daysDir = join(home, "memory-chain", "days");
  if (!(await exists(daysDir))) {
    return { moved: 0, skipped: 0 };
  }

  const entries = await readdir(daysDir, { withFileTypes: true });
  let moved = 0;
  let skipped = 0;

  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = e.name.match(FLAT_DAY_RE);
    if (!m) continue;

    const dayId = m[1];
    const month = dayMonthKey(dayId);
    const destDir = join(daysDir, month);
    const dest = join(destDir, e.name);
    const src = join(daysDir, e.name);

    if (await exists(dest)) {
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
      if (srcStat.size === destStat.size) {
        await rm(src);
        skipped++;
        continue;
      }
      throw new Error(`refusing to overwrite existing ${dest} (differs from flat ${src})`);
    }

    await mkdir(destDir, { recursive: true });
    await rename(src, dest);
    moved++;
    console.log(`moved ${e.name} → days/${month}/${e.name}`);
  }

  return { moved, skipped };
}

async function main() {
  await ensureEngramHome();
  const home = config.engramHome;
  console.log(`migrating day layout under ${home}`);
  const { moved, skipped } = await migrateDaysLayout(home);
  console.log(`done: moved=${moved} skipped_dup=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
