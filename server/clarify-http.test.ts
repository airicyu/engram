import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createClarifyAside,
  dismissClarify,
  isValidClarifyId,
  listClarifyAsking,
  listClarifyPending,
  submitClarifyAnswer,
} from "./store.ts";

test("clarify HTTP main path via live Bun.serve", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-cla-http-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "clarify", "asking"), { recursive: true });
  await mkdir(join(vault, "clarify", "pending"), { recursive: true });
  await mkdir(join(vault, "clarify", "history"), { recursive: true });
  await mkdir(join(vault, "pool"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");
  const id = "cla_20260920_http01";
  await writeFile(
    join(vault, "clarify", "asking", `${id}.md`),
    `---\nid: ${id}\nts: 2026-09-20T12:00:00+08:00\n---\n\nHTTP_CLA_Q_TOKEN\n`,
    "utf8",
  );

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;
      if (req.method === "GET" && pathname === "/clarify/asking") {
        return Response.json({ items: await listClarifyAsking(vault) });
      }
      if (req.method === "GET" && pathname === "/clarify/pending") {
        return Response.json({ items: await listClarifyPending(vault) });
      }
      const submit = pathname.match(/^\/clarify\/asking\/([^/]+)\/submit$/);
      if (req.method === "POST" && submit) {
        const cid = decodeURIComponent(submit[1]!);
        if (!isValidClarifyId(cid)) return Response.json({ error: "invalid_id" }, { status: 400 });
        const body = (await req.json().catch(() => null)) as { answer?: string } | null;
        const answer = body?.answer?.trim() ?? "";
        if (!answer) return Response.json({ error: "missing_answer" }, { status: 400 });
        return Response.json(await submitClarifyAnswer(cid, answer, vault));
      }
      const del = pathname.match(/^\/clarify\/asking\/([^/]+)$/);
      if (req.method === "DELETE" && del) {
        const cid = decodeURIComponent(del[1]!);
        if (!isValidClarifyId(cid)) return Response.json({ error: "invalid_id" }, { status: 400 });
        return Response.json(await dismissClarify(cid, vault));
      }
      if (req.method === "POST" && pathname === "/clarify/aside") {
        const body = (await req.json().catch(() => null)) as { raw?: string } | null;
        const raw = body?.raw?.trim() ?? "";
        if (!raw) return Response.json({ error: "missing_raw" }, { status: 400 });
        return Response.json(await createClarifyAside(raw, vault));
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });

  try {
    const emptyAsk = await fetch(`http://127.0.0.1:${server.port}/clarify/asking`);
    // has one item
    expect(emptyAsk.status).toBe(200);
    const askBody = await emptyAsk.json();
    expect(askBody.items.length).toBe(1);
    expect(askBody.items[0].id).toBe(id);

    const badId = await fetch(`http://127.0.0.1:${server.port}/clarify/asking/not-an-id/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: "x" }),
    });
    expect(badId.status).toBe(400);

    const sub = await fetch(`http://127.0.0.1:${server.port}/clarify/asking/${id}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: "HTTP_CLA_A_TOKEN" }),
    });
    expect(sub.status).toBe(200);
    expect(await sub.json()).toEqual({ id, present: true });

    const pending = await fetch(`http://127.0.0.1:${server.port}/clarify/pending`);
    expect(pending.status).toBe(200);
    const pBody = await pending.json();
    expect(pBody.items.length).toBe(1);
    expect(pBody.items[0].markdown).toContain("HTTP_CLA_A_TOKEN");

    const miss = await fetch(`http://127.0.0.1:${server.port}/clarify/asking/${id}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: "again" }),
    });
    expect(miss.status).toBe(200);
    expect((await miss.json()).present).toBe(false);

    const aside = await fetch(`http://127.0.0.1:${server.port}/clarify/aside`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: "HTTP_ASIDE_OK" }),
    });
    expect(aside.status).toBe(200);
    const asideBody = await aside.json();
    expect(isValidClarifyId(asideBody.id)).toBe(true);
    const pool = await readFile(join(vault, "pool", "pending.jsonl"), "utf8");
    expect(pool.trim()).toBe("");
    const asideMd = await readFile(join(vault, "clarify", "pending", `${asideBody.id}.md`), "utf8");
    expect(asideMd).toContain("kind: aside");

    const id2 = "cla_20260920_http02";
    await writeFile(
      join(vault, "clarify", "asking", `${id2}.md`),
      `---\nid: ${id2}\nts: 2026-09-20T13:00:00+08:00\n---\n\nbye\n`,
      "utf8",
    );
    const delRes = await fetch(`http://127.0.0.1:${server.port}/clarify/asking/${id2}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
    expect(await delRes.json()).toEqual({ id: id2, present: true });
    const hist = await readFile(join(vault, "clarify", "history", `${id2}.md`), "utf8");
    expect(hist).toContain("dismissed: true");
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
