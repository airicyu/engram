/**
 * HTTP entrypoint: starts Bun.serve and wires Engram API routes.
 */

import { config } from "./config";
import { ensureEngramHome } from "./store/home";
import { handleCapture } from "./api/capture";
import { handleStatus } from "./api/status";
import { handleClockGet, handleClockPut, handleClockDelete } from "./api/clock";
import { loadClockFromDisk } from "./store/clock";
import {
  handleDreamRun,
  handleDreamPending,
  handleDreamApprove,
  handleDreamDiscard,
  handleDreamCancel,
} from "./api/dream";
import { handleDreamEvents } from "./api/dream-events";
import { handleMemoryL1 } from "./api/memory/l1";
import { handleMemorySearchRequest } from "./api/memory/search";
import {
  handleMemoryAskPost,
  handleMemoryAskGet,
  handleMemoryAskCancel,
} from "./api/memory/ask";
import {
  handleChainIndex,
  handleChainDay,
  handleWeekIndex,
  handleWeekDetail,
  handleMonthIndex,
  handleMonthDetail,
  handleYearIndex,
  handleYearDetail,
} from "./api/memory/chain";
import { handleNodesIndex, handleNodeDetail } from "./api/memory/nodes";
import { handleFutureSight } from "./api/future-sight";
import { logError, logInfo, logMemory, withRequestLog } from "./log";
import { killAllTrackedAgentProcesses } from "./store/agent-process";

await ensureEngramHome();
await loadClockFromDisk();

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
  port: config.port,
  routes: {
    "/": {
      GET: withRequestLog(() =>
        Response.json({
          name: "engram",
          endpoints: [
            "POST /capture",
            "POST /dream/run",
            "POST /dream/cancel",
            "GET /dream/pending",
            "GET /dream/events",
            "POST /dream/approve",
            "POST /dream/discard",
            "GET /future-sight",
            "GET /memory/l1",
            "GET /memory/search",
            "GET /memory/chain",
            "GET /memory/chain/weeks",
            "GET /memory/chain/weeks/{week_id}",
            "GET /memory/chain/months",
            "GET /memory/chain/months/{month_id}",
            "GET /memory/chain/years",
            "GET /memory/chain/years/{year_id}",
            "GET /memory/chain/{day_id}",
            "GET /memory/nodes",
            "GET /memory/nodes/{node_id}",
            "POST /memory/ask",
            "GET /memory/ask/{job_id}",
            "POST /memory/ask/{job_id}/cancel",
            "GET /clock",
            "PUT /clock",
            "DELETE /clock",
            "GET /status",
          ],
        }),
      ),
    },

    "/status": {
      GET: withRequestLog(async () => Response.json(await handleStatus())),
    },

    "/clock": {
      GET: withRequestLog(() => Response.json(handleClockGet())),
      PUT: withRequestLog(async (req) => {
        let body: { now?: string; day?: string; time?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as typeof body;
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        const result = await handleClockPut(body);
        if (result instanceof Response) return result;
        return Response.json(result);
      }),
      DELETE: withRequestLog(async () => Response.json(await handleClockDelete())),
    },

    "/capture": {
      POST: withRequestLog(async (req) => {
        const body = (await req.json()) as {
          raw: string;
          source?: string;
          node_refs?: string[];
          idempotency_key?: string;
        };
        const result = await handleCapture(body);
        if (result instanceof Response) return result;
        logInfo("capture ok", {
          event_id: result.event_id,
          source: body.source ?? "api",
          node_refs: body.node_refs ?? [],
          raw_len: body.raw?.length ?? 0,
        });
        return Response.json(result, { status: 201 });
      }),
    },

    "/dream/run": {
      POST: withRequestLog(() => handleDreamRun()),
    },

    "/dream/cancel": {
      POST: withRequestLog(async (req) => {
        let body: { dream_run_id?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { dream_run_id?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleDreamCancel(body);
      }),
    },

    "/dream/pending": {
      GET: withRequestLog(() => handleDreamPending()),
    },

    "/dream/events": {
      GET: withRequestLog(async (req) => {
        const url = new URL(req.url);
        const runId = url.searchParams.get("run_id");
        const after = Number(url.searchParams.get("after") ?? "0");
        const result = await handleDreamEvents(runId, Number.isFinite(after) ? after : 0);
        if (result instanceof Response) return result;
        return Response.json(result);
      }),
    },

    "/dream/approve": {
      POST: withRequestLog(async (req) => {
        let body: { dream_run_id?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { dream_run_id?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleDreamApprove(body);
      }),
    },

    "/dream/discard": {
      POST: withRequestLog(async (req) => {
        let body: { dream_run_id?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { dream_run_id?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleDreamDiscard(body);
      }),
    },

    "/future-sight": {
      GET: withRequestLog(async () => {
        const body = await handleFutureSight();
        logInfo("future-sight", {
          anchors: (body as { anchors: unknown[] }).anchors.length,
          swept: (body as { swept_expired: unknown[] }).swept_expired.length,
        });
        return Response.json(body);
      }),
    },

    "/memory/l1": {
      GET: withRequestLog(async () => Response.json(await handleMemoryL1())),
    },

    "/memory/search": {
      GET: withRequestLog(async (req) => {
        const params = new URL(req.url).searchParams;
        const q = params.get("q");
        const scope = params.get("scope");
        const out = await handleMemorySearchRequest(q, scope);
        if ("error" in out) {
          const message =
            out.error === "missing_q"
              ? "Query parameter q is required"
              : "scope must be one or more of: l1, nodes, chain";
          return Response.json({ error: out.error, message }, { status: 400 });
        }
        const { result } = out;
        logMemory("search", {
          q: result.q,
          scope: result.scope,
          nodes: result.nodes?.length ?? 0,
          l1: result.l1 != null,
          chain_days: result.chain?.length ?? 0,
        });
        return Response.json(result);
      }),
    },

    "/memory/chain": {
      GET: withRequestLog(async () => {
        const body = await handleChainIndex();
        logMemory("browse chain index", { days: body.days.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memory/chain/weeks": {
      GET: withRequestLog(async () => {
        const body = await handleWeekIndex();
        logMemory("browse chain weeks", { weeks: body.weeks.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memory/chain/months": {
      GET: withRequestLog(async () => {
        const body = await handleMonthIndex();
        logMemory("browse chain months", { months: body.months.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memory/chain/years": {
      GET: withRequestLog(async () => {
        const body = await handleYearIndex();
        logMemory("browse chain years", { years: body.years.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memory/nodes": {
      GET: withRequestLog(async () => {
        const body = await handleNodesIndex();
        logMemory("browse nodes index", { nodes: body.nodes.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memory/ask": {
      POST: withRequestLog(async (req) => {
        let body: { q?: string } = {};
        try {
          body = (await req.json()) as { q?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleMemoryAskPost(body);
      }),
    },
  },

  fetch: withRequestLog(async (req) => {
    const url = new URL(req.url);

    const weekMatch = url.pathname.match(/^\/memory\/chain\/weeks\/([^/]+)$/);
    if (weekMatch && req.method === "GET") {
      const weekId = decodeURIComponent(weekMatch[1]!);
      const out = await handleWeekDetail(weekId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "week_id must be YYYY-Www (ISO week)" },
          { status: 400 },
        );
      }
      logMemory("browse chain week", { week_id: out.week_id, present: out.present });
      return Response.json(out);
    }

    const monthMatch = url.pathname.match(/^\/memory\/chain\/months\/([^/]+)$/);
    if (monthMatch && req.method === "GET") {
      const monthId = decodeURIComponent(monthMatch[1]!);
      const out = await handleMonthDetail(monthId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "month_id must be YYYY-MM" },
          { status: 400 },
        );
      }
      logMemory("browse chain month", { month_id: out.month_id, present: out.present });
      return Response.json(out);
    }

    const yearMatch = url.pathname.match(/^\/memory\/chain\/years\/([^/]+)$/);
    if (yearMatch && req.method === "GET") {
      const yearId = decodeURIComponent(yearMatch[1]!);
      const out = await handleYearDetail(yearId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "year_id must be YYYY" },
          { status: 400 },
        );
      }
      logMemory("browse chain year", { year_id: out.year_id, present: out.present });
      return Response.json(out);
    }

    const chainMatch = url.pathname.match(/^\/memory\/chain\/([^/]+)$/);
    if (chainMatch && req.method === "GET") {
      const dayId = decodeURIComponent(chainMatch[1]!);
      const out = await handleChainDay(dayId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "day_id must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
      logMemory("browse chain day", { day_id: out.day_id, present: out.present });
      return Response.json(out);
    }

    const nodesMatch = url.pathname.match(/^\/memory\/nodes\/([^/]+)$/);
    if (nodesMatch && req.method === "GET") {
      const nodeId = decodeURIComponent(nodesMatch[1]!);
      const out = await handleNodeDetail(nodeId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "node_id contains invalid characters" },
          { status: 400 },
        );
      }
      logMemory("browse nodes detail", { node: out.node, present: out.present });
      return Response.json(out);
    }

    const match = url.pathname.match(/^\/memory\/ask\/([^/]+)(\/cancel)?$/);
    if (match) {
      const jobId = decodeURIComponent(match[1]!);
      if (match[2] === "/cancel" && req.method === "POST") {
        return handleMemoryAskCancel(jobId);
      }
      if (req.method === "GET") {
        return handleMemoryAskGet(jobId);
      }
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }),

  error(error) {
    logError("unhandled", error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  },
});
} catch (e) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "EADDRINUSE") {
    logError(`port ${config.port} already in use — stop other bun dev or: kill-port ${config.port}`);
    process.exit(1);
  }
  throw e;
}

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logInfo(`shutdown ${signal}`);
  killAllTrackedAgentProcesses();
  try {
    server.stop(true);
  } catch {
    // already stopped
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logInfo(`engram listening on ${server.url}`);
logInfo(`ENGRAM_HOME=${config.engramHome}`);
logInfo(`ENGRAM_TZ=${config.timezone}`);
logInfo(`ENGRAM_AGENT=${process.env.ENGRAM_AGENT ?? "cursor"}`);
logInfo(`ENGRAM_ALLOW_VIRTUAL_CLOCK=${config.allowVirtualClock ? "1" : "0"}`);
