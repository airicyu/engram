import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendPendingWithAttachments,
  absAttachPath,
  isValidAttachPath,
  mimeFromFilename,
  saveAttachmentUpload,
  ALLOWED_ATTACH_MIME,
  MAX_ATTACH_BYTES,
  type AttachmentRef,
} from "../vault/index.ts";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("attachments HTTP: upload 201, file GET, events symmetry", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-att-http-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "pool"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");
  await writeFile(join(vault, "pool", "archived.jsonl"), "", "utf8");

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;

      if (req.method === "POST" && pathname === "/attachments") {
        let formData: FormData;
        try {
          formData = await req.formData();
        } catch {
          return Response.json({ error: "invalid_form_data" }, { status: 400 });
        }
        const file = formData.get("file");
        if (!file || !(file instanceof Blob)) {
          return Response.json({ error: "missing_file" }, { status: 400 });
        }
        const mime = (file as File).type || "";
        if (!ALLOWED_ATTACH_MIME.has(mime)) {
          return Response.json({ error: "invalid_mime" }, { status: 400 });
        }
        if (file.size > MAX_ATTACH_BYTES) {
          return Response.json({ error: "file_too_large" }, { status: 400 });
        }
        const candidate =
          file instanceof File && file.name?.trim() ? file.name.trim() : "upload";
        const bytes = new Uint8Array(await file.arrayBuffer());
        try {
          const result = await saveAttachmentUpload(bytes, candidate, mime, vault);
          return Response.json(result, { status: 201 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ error: msg }, { status: 400 });
        }
      }

      if (req.method === "GET" && pathname === "/attachments/file") {
        const rel = (url.searchParams.get("path") ?? "").trim();
        if (!rel || !isValidAttachPath(rel)) {
          return Response.json({ error: "invalid_path" }, { status: 400 });
        }
        const abs = absAttachPath(rel, vault);
        if (!abs) return Response.json({ error: "invalid_path" }, { status: 400 });
        const f = Bun.file(abs);
        if (!(await f.exists())) return Response.json({ error: "not_found" }, { status: 404 });
        return new Response(f, {
          headers: { "Content-Type": mimeFromFilename(rel.split("/").pop()!) },
        });
      }

      if (req.method === "POST" && pathname === "/events") {
        const body = (await req.json().catch(() => null)) as {
          raw?: string;
          attachments?: AttachmentRef[];
        } | null;
        const raw = body?.raw?.trim() ?? "";
        if (!raw) return Response.json({ error: "missing_raw" }, { status: 400 });
        try {
          const event = await appendPendingWithAttachments(raw, body?.attachments ?? null, vault);
          return Response.json({ event }, { status: 200 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ error: msg }, { status: 400 });
        }
      }

      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });

  try {
    const fd = new FormData();
    fd.append("file", new File([PNG_1X1], "menu.png", { type: "image/png" }));
    const up = await fetch(`http://127.0.0.1:${server.port}/attachments`, {
      method: "POST",
      body: fd,
    });
    expect(up.status).toBe(201);
    const upBody = await up.json();
    expect(upBody.path).toMatch(/^_attachments\/uploads\/\d{4}-\d{2}-\d{2}\/menu\.png$/);
    const disk = await readFile(join(vault, ...upBody.path.split("/")));
    expect(disk.equals(PNG_1X1)).toBe(true);

    const get = await fetch(
      `http://127.0.0.1:${server.port}/attachments/file?path=${encodeURIComponent(upBody.path)}`,
    );
    expect(get.status).toBe(200);
    expect(get.headers.get("Content-Type")).toBe("image/png");
    const got = Buffer.from(await get.arrayBuffer());
    expect(got.equals(PNG_1X1)).toBe(true);

    const miss = await fetch(
      `http://127.0.0.1:${server.port}/attachments/file?path=${encodeURIComponent("_attachments/uploads/2026-09-20/nope.png")}`,
    );
    expect(miss.status).toBe(404);

    // events: only embed → 400
    const onlyEmbed = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: `x\n\n![[${upBody.path}]]` }),
    });
    expect(onlyEmbed.status).toBe(400);
    expect((await onlyEmbed.json()).error).toBe("asymmetric_attachments");

    // only attachments → 400
    const onlyAtt = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raw: "x",
        attachments: [{ path: upBody.path, relationship: "當日菜單" }],
      }),
    });
    expect(onlyAtt.status).toBe(400);

    // both → 200
    const both = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raw: `午餐\n\n![[${upBody.path}]]`,
        attachments: [{ path: upBody.path, relationship: "當日菜單" }],
      }),
    });
    expect(both.status).toBe(200);
    const bothBody = await both.json();
    expect(bothBody.event.attachments[0].path).toBe(upBody.path);

    // no image → 200 like 0.2
    const plain = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: "純文字事件" }),
    });
    expect(plain.status).toBe(200);

    // alias → 400
    const alias = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raw: `![[${upBody.path}|別名]]`,
        attachments: [{ path: upBody.path, relationship: "x" }],
      }),
    });
    expect(alias.status).toBe(400);
    expect((await alias.json()).error).toBe("embed_alias");

    // bad mime
    const badFd = new FormData();
    badFd.append("file", new File([Buffer.from("hi")], "x.txt", { type: "text/plain" }));
    const bad = await fetch(`http://127.0.0.1:${server.port}/attachments`, {
      method: "POST",
      body: badFd,
    });
    expect(bad.status).toBe(400);
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
