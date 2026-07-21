/** Minimal structured console logging for the Engram API server. */

function ts(): string {
  return new Date().toISOString();
}

export function logInfo(msg: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[${ts()}] ${msg}`, extra);
  } else {
    console.log(`[${ts()}] ${msg}`);
  }
}

/** Dream pipeline milestones — always logged. */
export function logDream(msg: string, extra?: Record<string, unknown>): void {
  logInfo(`dream | ${msg}`, extra);
}

/** Verbose dream troubleshooting — set ENGRAM_DREAM_DEBUG=1 */
export function logDreamDebug(msg: string, extra?: Record<string, unknown>): void {
  if (process.env.ENGRAM_DREAM_DEBUG !== "1") return;
  logInfo(`dream debug | ${msg}`, extra);
}

/** Truncate agent stdout/stderr for safe console preview. */
export function previewText(text: string, max = 500): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export function logError(msg: string, err?: unknown, extra?: Record<string, unknown>): void {
  const detail =
    err instanceof Error
      ? { error: err.message, ...(extra ?? {}) }
      : err !== undefined
        ? { error: String(err), ...(extra ?? {}) }
        : extra;
  if (detail && Object.keys(detail).length > 0) {
    console.error(`[${ts()}] ${msg}`, detail);
  } else {
    console.error(`[${ts()}] ${msg}`);
  }
}

/** Wrap a route handler: log method, path, status, duration. */
export function withRequestLog(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const start = performance.now();
    const url = new URL(req.url);
    const path = url.pathname + url.search;
    try {
      const res = await handler(req);
      const ms = Math.round(performance.now() - start);
      logInfo(`${req.method} ${path} → ${res.status} ${ms}ms`);
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      logError(`${req.method} ${path} → ERROR ${ms}ms`, err);
      throw err;
    }
  };
}
