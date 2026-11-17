import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = join(import.meta.dir, "node-sidecars.ts");

async function store(): Promise<string> {
  return mkdtemp(join(tmpdir(), "engram-side-"));
}

function run(root: string, yes: boolean) {
  const args = ["run", script, "--", "--store", root];
  if (yes) args.push("--yes");
  return spawnSync("bun", args, { encoding: "utf8" });
}

test("dry-run writes nothing and --yes merges or keeps score sidecars", async () => {
  const root = await store();
  const nodes = join(root, "memories", "nodes");
  try {
    await mkdir(join(nodes, "alpha"), { recursive: true });
    await mkdir(join(nodes, "beta"), { recursive: true });
    await mkdir(join(nodes, "gamma"), { recursive: true });
    await mkdir(join(nodes, "empty"), { recursive: true });
    await writeFile(join(nodes, "alpha", "alpha.md"), "# Alpha\n\n虛構。\n");
    await writeFile(join(nodes, "alpha", "score.yaml"), "score: 140\n");
    await writeFile(
      join(nodes, "beta", "beta.md"),
      "---\nactivity_score: 10\n---\n# Beta\n",
    );
    await writeFile(join(nodes, "beta", "score.yaml"), "score: 80\nactivity_score: 1\n");
    await writeFile(join(nodes, "gamma", "node.meta.yaml"), "- not-a-map\n");
    await writeFile(join(nodes, "alpha", "node.meta.yaml"), "pinned: true\n");

    const dry = run(root, false);
    expect(dry.status).toBe(0);
    expect(await readFile(join(nodes, "alpha", "score.yaml"), "utf8")).toContain("score:");
    expect(await readFile(join(nodes, "alpha", "alpha.md"), "utf8")).not.toContain("activity_score");

    const wrote = run(root, true);
    expect(wrote.status).toBe(0);
    expect(wrote.stdout).not.toContain("虛構");
    const alpha = await readFile(join(nodes, "alpha", "alpha.md"), "utf8");
    expect(alpha).toContain("activity_score: 100");
    await expect(readFile(join(nodes, "alpha", "score.yaml"), "utf8")).rejects.toThrow();
    await expect(readFile(join(nodes, "alpha", "node.meta.yaml"), "utf8")).rejects.toThrow();
    const beta = await readFile(join(nodes, "beta", "beta.md"), "utf8");
    expect(beta).toContain("activity_score: 10");
    await expect(readFile(join(nodes, "beta", "score.yaml"), "utf8")).rejects.toThrow();
    expect(await readFile(join(nodes, "gamma", "node.meta.yaml"), "utf8")).toContain("not-a-map");
    const left = await readFile(join(nodes, "empty"), "utf8").catch(() => "dir");
    expect(left).toBe("dir");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
