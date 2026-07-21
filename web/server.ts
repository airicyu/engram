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
    // HTML import: Bun bundles linked CSS/JS (see Bun fullstack docs)
    "/": index,

    "/api/status": {
      GET: (req) => proxyApi(req, "/status"),
    },
    "/api/ingest": {
      POST: (req) => proxyApi(req, "/ingest"),
    },
    "/api/dream/run": {
      POST: (req) => proxyApi(req, "/dream/run"),
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
    "/api/activate": {
      GET: (req) => proxyApi(req, "/activate"),
    },
  },

  fetch() {
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

console.log(`engram web on ${server.url}`);
console.log(`proxy → ${ENGRAM_URL}`);
