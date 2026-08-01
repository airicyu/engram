/**
 * Mechanical Engram store migrate: add node score.yaml + registry (→ 0.19.0).
 *
 * Usage:
 *   bun .claude/skills/engram-migration/scripts/migrate-0.17-to-0.19.ts /abs/path/to/store
 *
 * Admits store_version in 0.17.x–0.18.x (same structure gen: no node scores).
 * Does NOT backup (caller／skill must backup first).
 */

import { access, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";

const TARGET_STORE_VERSION = "0.19.0";
const S0 = 100;

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

function asOfIso(): string {
  return new Date().toISOString();
}

function parseStoreVersion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

/** True if major.minor is 0.17 or 0.18 (structure gen without node scores). */
function isAdmittedFrom(version: string | null): boolean {
  if (!version) return true; // missing key: allow if disk looks like 0.17+ (caller checks)
  const m = version.match(/^(\d+)\.(\d+)\./);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major === 0 && (minor === 17 || minor === 18);
}

async function main() {
  const storeArg = process.argv[2];
  if (!storeArg) {
    console.error("Usage: bun migrate-0.17-to-0.19.ts /abs/path/to/store");
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
  if (fromVer === TARGET_STORE_VERSION) {
    console.log(`already store_version ${TARGET_STORE_VERSION}; nothing to do`);
    return;
  }
  if (fromVer && !isAdmittedFrom(fromVer)) {
    console.error(
      `refusing: store_version=${fromVer} not in 0.17.x–0.18.x (or already newer). Run prior hops first.`,
    );
    process.exit(1);
  }

  const nodesDir = join(storeDir, "memories", "nodes");
  const ids: string[] = [];
  if (await exists(nodesDir)) {
    const entries = await readdir(nodesDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) ids.push(e.name);
    }
  }
  ids.sort();

  const ts = asOfIso();
  let maxScore = 0;
  let written = 0;
  for (const id of ids) {
    const scorePath = join(nodesDir, id, "score.yaml");
    if (await exists(scorePath)) {
      try {
        const doc = parseYaml(await readFile(scorePath, "utf8")) as { score?: unknown };
        const s = typeof doc?.score === "number" ? doc.score : S0;
        if (s > maxScore) maxScore = s;
      } catch {
        /* keep */
      }
      continue;
    }
    await mkdir(join(nodesDir, id), { recursive: true });
    await writeFile(
      scorePath,
      stringifyYaml({ score: S0, score_timestamp: ts }),
      "utf8",
    );
    written++;
    if (S0 > maxScore) maxScore = S0;
  }

  // Prefer writing registry even with 0 nodes (max_score: 0).
  if (ids.length > 0 && maxScore === 0) maxScore = S0;
  const regPath = join(storeDir, "memories", "node-score-registry.yaml");
  await mkdir(join(storeDir, "memories"), { recursive: true });
  await writeFile(
    regPath,
    stringifyYaml({ max_score: ids.length === 0 ? 0 : maxScore, updated_at: ts }),
    "utf8",
  );

  ws.store_version = TARGET_STORE_VERSION;
  await writeFile(
    wsPath,
    `# Engram workspace preferences (per memory store)\n${stringifyYaml(ws)}`,
    "utf8",
  );

  console.log(`nodes: ${ids.length}, score.yaml written: ${written}, max_score=${ids.length === 0 ? 0 : maxScore}`);
  console.log(`store_version → ${TARGET_STORE_VERSION}`);

  if (await exists(join(storeDir, ".git"))) {
    await git(storeDir, [
      "add",
      "--",
      "memories/nodes",
      "memories/node-score-registry.yaml",
      "engram.workspace.yaml",
    ]);
    const st = await git(storeDir, ["diff", "--cached", "--name-only"]);
    if (st.stdout.trim()) {
      const c = await git(storeDir, [
        "commit",
        "-m",
        "engram: migrate store 0.18→0.19 node scores",
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
