import { mkdir, readdir, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { storeDir } from "../../../../server/paths.ts";

const KEEP_ROOT = new Set(["workspace.yaml", ".gitignore"]);

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function emptyDirKeepGitkeep(dir: string) {
  await mkdir(dir, { recursive: true });
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === ".gitkeep") continue;
    await rm(join(dir, name), { recursive: true, force: true });
  }
  if (!(await exists(join(dir, ".gitkeep")))) {
    await writeFile(join(dir, ".gitkeep"), "");
  }
}

if (!process.argv.includes("--yes")) {
  console.error("Refusing: pass --yes after the user confirms wiping the memory store.");
  console.error(`store=${storeDir}`);
  process.exit(1);
}

await mkdir(storeDir, { recursive: true });

const rootNames = await readdir(storeDir);
for (const name of rootNames) {
  if (KEEP_ROOT.has(name)) continue;
  if (name === "pool" || name === "chain" || name === "nodes" || name === "jobs") continue;
  await rm(join(storeDir, name), { recursive: true, force: true });
}

await emptyDirKeepGitkeep(join(storeDir, "pool"));
await writeFile(join(storeDir, "pool", "pending.jsonl"), "");
await writeFile(join(storeDir, "pool", "archived.jsonl"), "");

await emptyDirKeepGitkeep(join(storeDir, "chain"));
await emptyDirKeepGitkeep(join(storeDir, "nodes"));
await emptyDirKeepGitkeep(join(storeDir, "jobs"));

if (!(await exists(join(storeDir, "workspace.yaml")))) {
  await writeFile(
    join(storeDir, "workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: zh-Hant\npi_model: deepseek/deepseek-v4.1-flash\n",
  );
}

console.log(`reset ok  store=${storeDir}`);
console.log("kept workspace.yaml; emptied pool jsonl, chain, nodes, jobs");
