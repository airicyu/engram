import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { memoriesDir } from "../../../../server/config/paths.ts";

/**
 * One-off helper: move already-absorbed clarify files out of clarify/pending/
 * into clarify/history/. A file is considered safe to move when the history
 * copy exists AND its frontmatter has absorbed_at.
 *
 * Run: bun run .agents/skills/engram-lite-distill/scripts/move-absorbed-clarify.ts
 */
const vault = memoriesDir();
const pendingDir = join(vault, "clarify", "pending");
const historyDir = join(vault, "clarify", "history");

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

let names: string[] = [];
try {
  names = await readdir(pendingDir);
} catch {
  console.log("No clarify/pending/ directory; nothing to do.");
  process.exit(0);
}

let moved = 0;
for (const name of names) {
  if (!name.endsWith(".md")) continue;
  const historyPath = join(historyDir, name);

  if (!(await exists(historyPath))) {
    console.log(`skip ${name}: no history copy`);
    continue;
  }

  const historyText = await readFile(historyPath, "utf8");
  if (!/absorbed_at:/.test(historyText)) {
    console.log(`skip ${name}: history copy missing absorbed_at`);
    continue;
  }

  await rm(join(pendingDir, name), { force: true });
  console.log(`moved ${name} -> clarify/history/`);
  moved += 1;
}

console.log(`done; removed ${moved} file(s) from clarify/pending/`);
