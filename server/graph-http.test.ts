import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNodeGraph } from "./store.ts";

test("GET /nodes/graph contract via live Bun.serve", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-graph-http-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "nodes", "a"), { recursive: true });
  await mkdir(join(vault, "nodes", "b"), { recursive: true });
  await writeFile(join(vault, "nodes", "a", "a.md"), "# A\n\n[[nodes/b/b]]\n", "utf8");
  await writeFile(join(vault, "nodes", "b", "b.md"), "# B\n\n[[nodes/missing/missing]]\n", "utf8");

  const emptyRoot = await mkdtemp(join(tmpdir(), "engram-lite-graph-http-empty-"));
  const emptyVault = join(emptyRoot, "memories");
  await mkdir(emptyVault, { recursive: true });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/nodes/graph") {
        const which = url.searchParams.get("vault") === "empty" ? emptyVault : vault;
        return Response.json(await buildNodeGraph(which));
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });

  try {
    const empty = await fetch(`http://127.0.0.1:${server.port}/nodes/graph?vault=empty`);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ nodes: [], edges: [] });

    const ok = await fetch(`http://127.0.0.1:${server.port}/nodes/graph`);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.nodes.map((n: { id: string }) => n.id).sort()).toEqual(["a", "b"]);
    expect(body.edges).toEqual([{ from: "a", to: "b" }]);
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
    await rm(emptyRoot, { recursive: true, force: true });
  }
});
