/**
 * Mechanical Engram store migrate: node main `understand/what.md` → `{id}.md` (→ 0.28.0).
 *
 * Usage (offline — server need not be running):
 *   # from this skill directory:
 *   bun ./scripts/migrate-0.19-to-0.28.ts /abs/path/to/store
 *
 * Admits store_version major.minor in 0.19–0.27 (same pre-0.28 node layout).
 * Clears pending dreams offline (equiv. discard). Does NOT backup (caller／skill must).
 * Does NOT rewrite node prose into wikilinks.
 */

import { access, readdir, readFile, writeFile, rm, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "../../../../server/src/yaml.ts";

const TARGET_STORE_VERSION = "0.28.0";

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

/** True if major.minor ∈ 0.19–0.27. */
function isAdmittedFrom(version: string | null): boolean {
  if (!version) return true; // missing: allow if disk has legacy what.md (caller may rely on heuristic)
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  if (mm.major !== 0) return false;
  return mm.minor >= 19 && mm.minor <= 27;
}

function isAlreadyTarget(version: string | null): boolean {
  if (!version) return false;
  const mm = parseMajorMinor(version);
  if (!mm) return false;
  return mm.major > 0 || (mm.major === 0 && mm.minor >= 28);
}

/** Stub INDEX that only points at understand/what.md (safe to delete). */
function looksLikeStubIndex(text: string, nodeId: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/understand\/what\.md/i.test(t)) return true;
  // Very short title-only stub: "# id" + optional blank
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 2 && lines[0]?.startsWith("#") && lines[0].includes(nodeId)) {
    return true;
  }
  return false;
}

async function discardPendingOffline(storeDir: string): Promise<string[]> {
  const discarded: string[] = [];
  const runsDir = join(storeDir, "dreams", "runs");
  const draftRoot = join(storeDir, "dreams", "draft");

  if (await exists(runsDir)) {
    const entries = await readdir(runsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".yaml")) continue;
      const p = join(runsDir, e.name);
      let doc: Record<string, unknown>;
      try {
        const parsed = parseYaml(await readFile(p, "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        doc = parsed as Record<string, unknown>;
      } catch {
        continue;
      }
      if (doc.status !== "pending") continue;
      const id = typeof doc.id === "string" ? doc.id : e.name.replace(/\.yaml$/, "");
      doc.status = "discarded";
      await writeFile(p, stringifyYaml(doc), "utf8");
      discarded.push(id);
    }
  }

  // Remove every draft tree (even orphans without a pending run yaml).
  if (await exists(draftRoot)) {
    const drafts = await readdir(draftRoot, { withFileTypes: true });
    for (const d of drafts) {
      if (!d.isDirectory()) continue;
      if (!discarded.includes(d.name)) discarded.push(d.name);
      await rm(join(draftRoot, d.name), { recursive: true, force: true });
    }
  }

  // Clear extract-state so upgraded server does not think a job is mid-flight.
  const extractPath = join(storeDir, "dreams", "extract-state.yaml");
  if (await exists(extractPath)) {
    await writeFile(
      extractPath,
      stringifyYaml({ status: "never" }),
      "utf8",
    );
  }

  // Clear dream.lock (equiv. break／release so upgraded server is not stuck locked).
  const lockPath = join(storeDir, "dreams", "dream.lock");
  if (await exists(lockPath)) {
    await rm(lockPath, { force: true });
    console.log("removed dreams/dream.lock");
  }

  return [...new Set(discarded)];
}

async function migrateNode(nodeDir: string, id: string): Promise<"moved" | "already" | "skip"> {
  const legacy = join(nodeDir, "understand", "what.md");
  const main = join(nodeDir, `${id}.md`);
  const hasLegacy = await exists(legacy);
  const hasMain = await exists(main);

  if (hasLegacy && hasMain) {
    throw new Error(
      `conflict: both understand/what.md and ${id}.md exist under memories/nodes/${id}/ — refuse`,
    );
  }

  if (hasLegacy && !hasMain) {
    await rename(legacy, main);
  }

  // Remove empty understand/ (and leftover empty dirs).
  const understandDir = join(nodeDir, "understand");
  if (await exists(understandDir)) {
    const left = await readdir(understandDir);
    if (left.length === 0) {
      await rm(understandDir, { recursive: true, force: true });
    }
  }

  // Delete obvious stub INDEX.md / index.md
  for (const name of ["INDEX.md", "index.md"]) {
    const indexPath = join(nodeDir, name);
    if (!(await exists(indexPath))) continue;
    const text = await readFile(indexPath, "utf8");
    if (looksLikeStubIndex(text, id)) {
      await rm(indexPath, { force: true });
    } else {
      console.warn(
        `keeping non-stub ${name} under nodes/${id}/ (does not look like understand/what pointer)`,
      );
    }
  }

  if (hasLegacy && !hasMain) return "moved";
  if (hasMain) return "already";
  return "skip";
}

async function main() {
  const storeArg = process.argv[2];
  if (!storeArg) {
    console.error("Usage: bun migrate-0.19-to-0.28.ts /abs/path/to/store");
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
    // Still allow if disk somehow still has legacy paths? Prefer exit clean when stamped.
    console.log(`already store_version ${fromVer}; nothing to do`);
    return;
  }
  if (fromVer && !isAdmittedFrom(fromVer)) {
    console.error(
      `refusing: store_version=${fromVer} not in 0.19.x–0.27.x. Run prior hops first (e.g. migrate-0.17-to-0.19).`,
    );
    process.exit(1);
  }

  console.log("migrate-0.19-to-0.28: offline hop (server need not be running)");

  const discarded = await discardPendingOffline(storeDir);
  if (discarded.length) {
    console.log(`discarded pending dream(s): ${discarded.join(", ")}`);
  } else {
    console.log("discarded pending dream(s): (none)");
  }

  const nodesDir = join(storeDir, "memories", "nodes");
  let moved = 0;
  let already = 0;
  let skipped = 0;
  if (await exists(nodesDir)) {
    const entries = await readdir(nodesDir, { withFileTypes: true });
    const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    for (const id of ids) {
      const result = await migrateNode(join(nodesDir, id), id);
      if (result === "moved") moved++;
      else if (result === "already") already++;
      else skipped++;
    }
    console.log(`nodes: ${ids.length}, moved: ${moved}, already {id}.md: ${already}, no main file: ${skipped}`);
  } else {
    console.log("nodes: 0 (no memories/nodes)");
  }

  // Do NOT create memories/_attachments/ (0.28 has no attachments).

  ws.store_version = TARGET_STORE_VERSION;
  await writeFile(
    wsPath,
    `# Engram workspace preferences (per memory store)\n${stringifyYaml(ws)}`,
    "utf8",
  );
  console.log(`store_version → ${TARGET_STORE_VERSION}`);

  if (await exists(join(storeDir, ".git"))) {
    await git(storeDir, ["add", "-A", "--", "memories/nodes", "dreams", "engram.workspace.yaml"]);
    const st = await git(storeDir, ["diff", "--cached", "--name-only"]);
    if (st.stdout.trim()) {
      const msg =
        discarded.length > 0
          ? `engram: migrate store →0.28 node {id}.md (discarded pending: ${discarded.join(", ")})`
          : "engram: migrate store →0.28 node {id}.md";
      const c = await git(storeDir, ["commit", "-m", msg]);
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

  // Self-check hints
  const draftLeft = join(storeDir, "dreams", "draft");
  if (await exists(draftLeft)) {
    const left = await readdir(draftLeft);
    if (left.length) {
      console.warn(`warning: dreams/draft still has entries: ${left.join(", ")}`);
    }
  }
  console.log("done. Obsidian vault root = memories/ (open that folder, not store root).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
