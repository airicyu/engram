import index from "./index.html";

const ENGRAM_URL = (process.env.ENGRAM_URL ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);
const PORT = Number(process.env.WEB_PORT ?? 8788);

async function proxyApi(req: Request, apiPath: string): Promise<Response> {
  const start = performance.now();
  const url = new URL(req.url);
  const target = `${ENGRAM_URL}${apiPath}${url.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
  };
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

const server = Bun.serve({
  port: PORT,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,

    "/api/status": {
      GET: (req) => proxyApi(req, "/status"),
    },
    "/api/capture": {
      POST: (req) => proxyApi(req, "/capture"),
    },
    "/api/dream/run": {
      POST: (req) => proxyApi(req, "/dream/run"),
    },
    "/api/dream/cancel": {
      POST: (req) => proxyApi(req, "/dream/cancel"),
    },
    "/api/dream/pending": {
      GET: (req) => proxyApi(req, "/dream/pending"),
    },
    "/api/dream/approve": {
      POST: (req) => proxyApi(req, "/dream/approve"),
    },
    "/api/dream/discard": {
      POST: (req) => proxyApi(req, "/dream/discard"),
    },
    "/api/memory/l1": {
      GET: (req) => proxyApi(req, "/memory/l1"),
    },
    "/api/memory/search": {
      GET: (req) => proxyApi(req, "/memory/search"),
    },
    "/api/memory/ask": {
      POST: (req) => proxyApi(req, "/memory/ask"),
    },
    "/api/memory/chain": {
      GET: (req) => proxyApi(req, "/memory/chain"),
    },
    "/api/memory/nodes": {
      GET: (req) => proxyApi(req, "/memory/nodes"),
    },
  },

  fetch(req) {
    const url = new URL(req.url);
    const chainMatch = url.pathname.match(/^\/api\/memory\/chain\/([^/]+)$/);
    if (chainMatch) {
      const dayId = encodeURIComponent(decodeURIComponent(chainMatch[1]!));
      return proxyApi(req, `/memory/chain/${dayId}`);
    }
    const nodesMatch = url.pathname.match(/^\/api\/memory\/nodes\/([^/]+)$/);
    if (nodesMatch) {
      const nodeId = encodeURIComponent(decodeURIComponent(nodesMatch[1]!));
      return proxyApi(req, `/memory/nodes/${nodeId}`);
    }
    const match = url.pathname.match(/^\/api\/memory\/ask\/([^/]+)(\/cancel)?$/);
    if (match) {
      const jobId = encodeURIComponent(decodeURIComponent(match[1]!));
      if (match[2] === "/cancel") {
        return proxyApi(req, `/memory/ask/${jobId}/cancel`);
      }
      return proxyApi(req, `/memory/ask/${jobId}`);
    }
    return new Response("Not found", { status: 404 });
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
console.log(`proxy → ${ENGRAM_URL}`);
