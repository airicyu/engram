/**
 * Move a missing activity_score into the node file and delete residual sidecars.
 * Default is dry-run. `--yes` writes. `--store` is the store root.
 */
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  mergeActivityScoreIntoMarkdown,
  parseActivityScoreFromMarkdown,
  parseActivityScoreFromYaml,
} from "../server/nodes/score.ts";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const storeFlag = args.indexOf("--store");
const store = storeFlag >= 0 ? args[storeFlag + 1] : "";

if (!store) {
  console.error("usage: bun run nodes:sidecars -- --store <store-root> [--yes]");
  process.exit(1);
}

const nodesRoot = join(store, "memories", "nodes");

function isYamlMapping(text: string): boolean {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
  return lines.every((line) => /^[A-Za-z0-9_][A-Za-z0-9_-]*:/.test(line));
}

async function main() {
  let names: string[] = [];
  try {
    names = await readdir(nodesRoot);
  } catch {
    console.log("nodes: none");
    return;
  }

  for (const id of names) {
    const dir = join(nodesRoot, id);
    const scorePath = join(dir, "score.yaml");
    const metaPath = join(dir, "node.meta.yaml");
    const mdPath = join(dir, `${id}.md`);

    let scoreText: string | null = null;
    try {
      scoreText = await readFile(scorePath, "utf8");
    } catch {
      scoreText = null;
    }
    if (scoreText !== null) {
      const rel = `memories/nodes/${id}/score.yaml`;
      let markdown: string | null = null;
      try {
        markdown = await readFile(mdPath, "utf8");
      } catch {
        markdown = null;
      }
      const fromSide = parseActivityScoreFromYaml(scoreText);
      const existing = markdown === null ? null : parseActivityScoreFromMarkdown(markdown);
      const canDelete = existing !== null || (markdown !== null && fromSide !== null);
      console.log(`${yes ? "write" : "dry-run"} ${rel}`);
      if (!canDelete) {
        console.log(`keep ${rel}`);
      } else if (yes) {
        if (existing === null && fromSide !== null && markdown !== null) {
          await writeFile(mdPath, mergeActivityScoreIntoMarkdown(markdown, fromSide), "utf8");
        }
        await rm(scorePath);
      }
    }

    let metaText: string | null = null;
    try {
      metaText = await readFile(metaPath, "utf8");
    } catch {
      metaText = null;
    }
    if (metaText !== null) {
      const rel = `memories/nodes/${id}/node.meta.yaml`;
      if (!isYamlMapping(metaText)) {
        console.log(`keep ${rel}`);
        continue;
      }
      console.log(`${yes ? "delete" : "dry-run"} ${rel}`);
      if (yes) await rm(metaPath);
    }
  }
}

await main();
