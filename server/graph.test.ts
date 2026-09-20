import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNodeGraph, extractNodeWikilinks } from "./store.ts";

test("extractNodeWikilinks accepts [[nodes/id/id]] and alias form", () => {
  const md = `
See [[nodes/alpha/alpha]] and [[nodes/beta/beta|Beta Display]].
Mismatched [[nodes/foo/bar]] ignored.
Dead-looking [[nodes/gamma/gamma]] still extracted (existence checked later).
`;
  expect(extractNodeWikilinks(md).sort()).toEqual(["alpha", "beta", "gamma"]);
});

test("buildNodeGraph: empty vault → empty envelope", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-graph-empty-"));
  const vault = join(root, "memories");
  await mkdir(vault, { recursive: true });
  try {
    expect(await buildNodeGraph(vault)).toEqual({ nodes: [], edges: [] });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildNodeGraph: mutual + one-way wikilinks; dead links ignored; undirected dedup", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-graph-"));
  const vault = join(root, "memories");
  const nodes = join(vault, "nodes");
  await mkdir(join(nodes, "alpha"), { recursive: true });
  await mkdir(join(nodes, "beta"), { recursive: true });
  await mkdir(join(nodes, "gamma"), { recursive: true });

  await writeFile(
    join(nodes, "alpha", "alpha.md"),
    "# Alpha\n\nLinks [[nodes/beta/beta|Beta]] and dead [[nodes/nope/nope]].\n",
    "utf8",
  );
  await writeFile(
    join(nodes, "beta", "beta.md"),
    "# Beta Title\n\nBack to [[nodes/alpha/alpha]] and also [[nodes/gamma/gamma]].\n",
    "utf8",
  );
  await writeFile(
    join(nodes, "gamma", "gamma.md"),
    "# Gamma\n\nNo outgoing links.\n",
    "utf8",
  );

  try {
    const g = await buildNodeGraph(vault);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta", "gamma"]);
    expect(g.nodes.find((n) => n.id === "beta")!.title).toBe("Beta Title");
    expect(g.nodes.find((n) => n.id === "alpha")!.title).toBe("Alpha");

    // alpha–beta once (both directions), beta–gamma once; nope ignored
    expect(g.edges).toEqual([
      { from: "alpha", to: "beta" },
      { from: "beta", to: "gamma" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildNodeGraph: title falls back to id when no # heading", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-graph-title-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "nodes", "solo"), { recursive: true });
  await writeFile(join(vault, "nodes", "solo", "solo.md"), "no heading here\n", "utf8");
  try {
    const g = await buildNodeGraph(vault);
    expect(g.nodes).toEqual([{ id: "solo", title: "solo" }]);
    expect(g.edges).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
