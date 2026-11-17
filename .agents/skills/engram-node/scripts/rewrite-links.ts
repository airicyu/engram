import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RewriteMode = "merge" | "delete";

export type RewriteResult = {
  files: string[];
};

function assertId(id: string, flag: string) {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error(`invalid ${flag}`);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkPattern(id: string) {
  const idPath = escapeRegExp(`${id}/${id}`);
  return new RegExp(`\\[\\[nodes/${idPath}(?:\\|([^\\]]+))?\\]\\]`, "g");
}

export function rewriteLinkText(text: string, mode: RewriteMode, fromId: string, intoId?: string): string {
  return text.replace(linkPattern(fromId), (full, label: string | undefined) => {
    if (mode === "merge") {
      if (!intoId) throw new Error("merge requires into id");
      return label !== undefined ? `[[nodes/${intoId}/${intoId}|${label}]]` : `[[nodes/${intoId}/${intoId}]]`;
    }
    return label !== undefined ? label : fromId;
  });
}

async function listFiles(dir: string, recursive: boolean): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir, { recursive });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (typeof name !== "string" || !name.endsWith(".md")) continue;
    if (!recursive && name.includes("/")) continue;
    out.push(join(dir, name));
  }
  return out;
}

async function rewriteFile(path: string, mode: RewriteMode, fromId: string, intoId: string | undefined, touched: string[]) {
  const before = await readFile(path, "utf8");
  const after = rewriteLinkText(before, mode, fromId, intoId);
  if (after !== before) {
    await writeFile(path, after);
    touched.push(path);
  }
}

async function rewritePending(path: string, mode: RewriteMode, fromId: string, intoId: string | undefined, touched: string[]) {
  let before: string;
  try {
    before = await readFile(path, "utf8");
  } catch {
    return;
  }
  const lines = before.split("\n");
  let changed = false;
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    const replaced = rewriteLinkText(line, mode, fromId, intoId);
    if (replaced === line) return line;
    JSON.parse(replaced);
    changed = true;
    return replaced;
  });
  if (!changed) return;
  const body = next.join("\n");
  await writeFile(path, body);
  touched.push(path);
}

export async function rewriteNodeLinks(opts: {
  storeDir: string;
  mode: RewriteMode;
  fromId: string;
  intoId?: string;
}): Promise<RewriteResult> {
  assertId(opts.fromId, "from");
  if (opts.mode === "merge") {
    if (!opts.intoId) throw new Error("merge requires into id");
    assertId(opts.intoId, "into");
    if (opts.fromId === opts.intoId) throw new Error("from and into are the same id");
  }
  const memories = join(opts.storeDir, "memories");
  const touched: string[] = [];
  const mdDirs = [
    { dir: join(memories, "chain"), recursive: true },
    { dir: join(memories, "nodes"), recursive: true },
    { dir: join(memories, "future-sight"), recursive: false },
  ];
  for (const { dir, recursive } of mdDirs) {
    for (const file of await listFiles(dir, recursive)) {
      await rewriteFile(file, opts.mode, opts.fromId, opts.intoId, touched);
    }
  }
  await rewritePending(join(memories, "pool", "pending.jsonl"), opts.mode, opts.fromId, opts.intoId, touched);
  if (opts.mode === "delete") {
    await rm(join(memories, "nodes", opts.fromId), { recursive: true, force: true });
  }
  return { files: touched };
}

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const mode = process.argv[2];
  const storeDir = arg("--store");
  if (!storeDir || (mode !== "merge" && mode !== "delete")) {
    console.error("usage: rewrite-links.ts merge|delete --store DIR (--from ID --into ID | --id ID)");
    process.exit(1);
  }
  try {
    const result =
      mode === "merge"
        ? await rewriteNodeLinks({
            storeDir,
            mode,
            fromId: arg("--from") ?? "",
            intoId: arg("--into"),
          })
        : await rewriteNodeLinks({
            storeDir,
            mode: "delete",
            fromId: arg("--id") ?? "",
          });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
