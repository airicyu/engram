/**
 * CORS for browser callers on localhost (any port).
 * Reflects Origin when it is http(s)://localhost|127.0.0.1|[::1][:port].
 * Non-local Origins get no ACAO headers (same as before).
 */

const LOCAL_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOW_HEADERS = "Content-Type, Authorization";

/** True when Origin is a local browser page (any port). */
export function isLocalhostOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return LOCAL_ORIGIN_RE.test(origin);
}

function mergeVary(existing: string | null, value: string): string {
  if (!existing) return value;
  const parts = existing.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === value.toLowerCase())) return existing;
  return `${existing}, ${value}`;
}

/** CORS response headers for an allowed local Origin, or null if Origin is absent/non-local. */
export function corsHeaderPairs(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (!isLocalhostOrigin(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Attach localhost CORS headers onto an existing Response (no-op if Origin not local). */
export function applyCors(req: Request, res: Response): Response {
  const pairs = corsHeaderPairs(req);
  if (!pairs) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(pairs)) {
    if (k === "Vary") {
      headers.set("Vary", mergeVary(headers.get("Vary"), v));
    } else {
      headers.set(k, v);
    }
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Preflight for local Origins; 204 with CORS headers. Non-local → 204 without ACAO. */
export function corsPreflight(req: Request): Response {
  const pairs = corsHeaderPairs(req);
  return new Response(null, {
    status: 204,
    headers: pairs ?? undefined,
  });
}
