import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchMemories } from "../vault/index.ts";

/** Thin route mirror of GET /search contract (same rules as server/index.ts). */
function searchResponse(qRaw: string | null) {
  const q = (qRaw ?? "").trim();
  if (!q) return { status: 400 as const, body: { error: "missing_q" } };
  return null; // caller fills hits
}

test("GET /search contract: empty/blank q → 400", () => {
  expect(searchResponse(null)?.status).toBe(400);
  expect(searchResponse("")?.status).toBe(400);
  expect(searchResponse("   ")?.status).toBe(400);
});

test("GET /search contract: hits envelope via live Bun.serve", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-search-http-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "chain", "days", "2026-09"), { recursive: true });
  await writeFile(
    join(vault, "chain", "days", "2026-09", "2026-09-16.md"),
    "HTTP_SEARCH_TOKEN_OK\n",
    "utf8",
  );

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/search") {
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return Response.json({ error: "missing_q" }, { status: 400 });
        return Response.json({ hits: await searchMemories(q, vault) });
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });

  try {
    const bad = await fetch(`http://127.0.0.1:${server.port}/search?q=`);
    expect(bad.status).toBe(400);
    const badBody = await bad.json();
    expect(badBody.error).toBe("missing_q");

    const miss = await fetch(`http://127.0.0.1:${server.port}/search?q=${encodeURIComponent("ZZZ_NO_HIT")}`);
    expect(miss.status).toBe(200);
    expect(await miss.json()).toEqual({ hits: [] });

    const ok = await fetch(
      `http://127.0.0.1:${server.port}/search?q=${encodeURIComponent("HTTP_SEARCH_TOKEN_OK")}`,
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(Array.isArray(body.hits)).toBe(true);
    expect(body.hits.length).toBe(1);
    expect(body.hits[0].path).toBe("chain/days/2026-09/2026-09-16.md");
    expect(body.hits[0].snippet).toContain("HTTP_SEARCH_TOKEN_OK");
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
