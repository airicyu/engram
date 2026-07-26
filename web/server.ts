/**
 * Production static server for Vite `dist/` + `/api` proxy to Engram.
 * Dev uses Vite (`bun run dev`).
 */
import { join } from "node:path";

const ENGRAM_URL = (process.env.ENGRAM_URL ?? "http://localhost:8787").replace(/\/$/, "");
const PORT = Number(process.env.WEB_PORT ?? 8788);
const DIST = join(import.meta.dir, "dist");

async function proxyApi(req: Request, apiPath: string): Promise<Response> {
  const start = performance.now();
  const url = new URL(req.url);
  const target = `${ENGRAM_URL}${apiPath}${url.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const ms = Math.round(performance.now() - start);
    console.log(
      `[${new Date().toISOString()}] ${req.method} /api${apiPath}${url.search} → ${upstream.status} ${ms}ms`,
    );
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    const ms = Math.round(performance.now() - start);
    console.error(
      `[${new Date().toISOString()}] ${req.method} /api${apiPath} → ERROR ${ms}ms`,
      e instanceof Error ? e.message : e,
    );
    return Response.json(
      {
        error: "engram_unreachable",
        message:
          e instanceof Error
            ? e.message
            : "Cannot reach Engram API — is the server running?",
        engram_url: ENGRAM_URL,
      },
      { status: 502 },
    );
  }
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(DIST, rel);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { "content-type": contentTypeFor(rel) },
    });
  }
  // SPA fallback
  const index = Bun.file(join(DIST, "index.html"));
  if (await index.exists()) {
    return new Response(index, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response("dist/ missing — run: bun run build", { status: 500 });
}

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/status" && req.method === "GET") {
      return proxyApi(req, "/status");
    }
    if (url.pathname === "/api/activities" && req.method === "POST") {
      return proxyApi(req, "/activities");
    }
    if (url.pathname === "/api/dreams/run" && req.method === "POST") {
      return proxyApi(req, "/dreams/run");
    }
    if (url.pathname === "/api/dreams/cancel" && req.method === "POST") {
      return proxyApi(req, "/dreams/cancel");
    }
    if (url.pathname === "/api/dreams/pending" && req.method === "GET") {
      return proxyApi(req, "/dreams/pending");
    }
    if (url.pathname === "/api/dreams/approve" && req.method === "POST") {
      return proxyApi(req, "/dreams/approve");
    }
    if (url.pathname === "/api/dreams/discard" && req.method === "POST") {
      return proxyApi(req, "/dreams/discard");
    }
    if (url.pathname === "/api/dreams/retry" && req.method === "POST") {
      return proxyApi(req, "/dreams/retry");
    }
    if (url.pathname === "/api/memories/short-term-memory" && req.method === "GET") {
      return proxyApi(req, "/memories/short-term-memory");
    }
    if (url.pathname === "/api/memories/search" && req.method === "GET") {
      return proxyApi(req, "/memories/search");
    }
    if (url.pathname === "/api/memories/ask" && req.method === "POST") {
      return proxyApi(req, "/memories/ask");
    }
    if (url.pathname === "/api/memories/chain" && req.method === "GET") {
      return proxyApi(req, "/memories/chain");
    }
    if (url.pathname === "/api/memories/chain/weeks" && req.method === "GET") {
      return proxyApi(req, "/memories/chain/weeks");
    }
    if (url.pathname === "/api/memories/chain/months" && req.method === "GET") {
      return proxyApi(req, "/memories/chain/months");
    }
    if (url.pathname === "/api/memories/chain/years" && req.method === "GET") {
      return proxyApi(req, "/memories/chain/years");
    }
    if (url.pathname === "/api/memories/nodes" && req.method === "GET") {
      return proxyApi(req, "/memories/nodes");
    }

    const weekMatch = url.pathname.match(/^\/api\/memories\/chain\/weeks\/([^/]+)$/);
    if (weekMatch) {
      const id = encodeURIComponent(decodeURIComponent(weekMatch[1]!));
      return proxyApi(req, `/memories/chain/weeks/${id}`);
    }
    const monthMatch = url.pathname.match(/^\/api\/memories\/chain\/months\/([^/]+)$/);
    if (monthMatch) {
      const id = encodeURIComponent(decodeURIComponent(monthMatch[1]!));
      return proxyApi(req, `/memories/chain/months/${id}`);
    }
    const yearMatch = url.pathname.match(/^\/api\/memories\/chain\/years\/([^/]+)$/);
    if (yearMatch) {
      const id = encodeURIComponent(decodeURIComponent(yearMatch[1]!));
      return proxyApi(req, `/memories/chain/years/${id}`);
    }
    const chainMatch = url.pathname.match(/^\/api\/memories\/chain\/([^/]+)$/);
    if (chainMatch) {
      const dayId = encodeURIComponent(decodeURIComponent(chainMatch[1]!));
      return proxyApi(req, `/memories/chain/${dayId}`);
    }
    const nodesMatch = url.pathname.match(/^\/api\/memories\/nodes\/([^/]+)$/);
    if (nodesMatch) {
      const nodeId = encodeURIComponent(decodeURIComponent(nodesMatch[1]!));
      return proxyApi(req, `/memories/nodes/${nodeId}`);
    }
    const askMatch = url.pathname.match(/^\/api\/memories\/ask\/([^/]+)(\/cancel)?$/);
    if (askMatch) {
      const jobId = encodeURIComponent(decodeURIComponent(askMatch[1]!));
      if (askMatch[2] === "/cancel") {
        return proxyApi(req, `/memories/ask/${jobId}/cancel`);
      }
      return proxyApi(req, `/memories/ask/${jobId}`);
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    return serveStatic(url.pathname);
  },
  error(error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  },
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`shutdown ${signal}`);
  server.stop(true);
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(`engram web on ${server.url}`);
console.log(`serving ${DIST}`);
console.log(`proxy → ${ENGRAM_URL}`);
