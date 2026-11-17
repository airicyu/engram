import { mkdir, readdir, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { memoriesDir, storeDir } from "../../../../server/config/paths.ts";
import { commitStore } from "../../../../server/git/store-git.ts";

const KEEP_ROOT = new Set(["workspace.yaml", ".gitignore", "memories", "jobs"]);

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
  await rm(join(storeDir, name), { recursive: true, force: true });
}

const vault = memoriesDir();
await mkdir(vault, { recursive: true });

await emptyDirKeepGitkeep(join(vault, "pool"));
await writeFile(join(vault, "pool", "pending.jsonl"), "");
await writeFile(join(vault, "pool", "archived.jsonl"), "");

await emptyDirKeepGitkeep(join(vault, "chain"));
await emptyDirKeepGitkeep(join(vault, "nodes"));
await emptyDirKeepGitkeep(join(vault, "_attachments", "uploads"));
await emptyDirKeepGitkeep(join(vault, "clarify", "asking"));
await emptyDirKeepGitkeep(join(vault, "clarify", "pending"));
await emptyDirKeepGitkeep(join(vault, "clarify", "history"));
await emptyDirKeepGitkeep(join(storeDir, "jobs"));

if (!(await exists(join(storeDir, "workspace.yaml")))) {
  await writeFile(
    join(storeDir, "workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: zh-Hant\npi_model: deepseek/deepseek-v4.1-flash\n",
  );
}

console.log(`reset ok  store=${storeDir}`);
console.log("kept workspace.yaml; emptied memories pool/chain/nodes/_attachments/clarify, jobs");
await commitStore(storeDir, { op: "reset" });
