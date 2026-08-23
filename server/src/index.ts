/**
 * HTTP entrypoint: starts Bun.serve and wires Engram API routes.
 */

import { config } from "./config";
import { ensureEngramHome } from "./store/home";
import { assertStoreStructureOrExit } from "./store/store-structure";
import { handleActivities } from "./api/activities";
import { handleUpload, handleDeleteTmp, handleHousekeep, handleGetFile } from "./api/attachments";
import { handleStatus } from "./api/status";
import { handleClockGet, handleClockPut, handleClockDelete } from "./api/clock";
import { loadClockFromDisk } from "./store/clock";
import {
  handleDreamRun,
  handleDreamRetry,
  handleDreamAmend,
} from "./api/dream/run";
import {
  handleDreamPending,
  handleDreamApprove,
  handleDreamDiscard,
  handleDreamCancel,
} from "./api/dream/review";
import { handlePatchNodeScoreInvolvements } from "./api/dream/involvements";
import { handleDreamEvents } from "./api/dream/events";
import { handleShortTermMemory } from "./api/memory/short-term-memory";
import { handleMemorySearchRequest } from "./api/seek/search";
import {
  handleMemoryAskPost,
  handleMemoryAskGet,
  handleMemoryAskCancel,
  handleMemoryAskRecent,
} from "./api/seek/ask";
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
import { handleNodesIndex, handleNodesGraph, handleNodeDetail } from "./api/memory/nodes";
import { handleFutureSight } from "./api/memory/future-sight";
import {
  handleClarifyAside,
  handleClarifyDismiss,
  handleClarifyListAsking,
  handleClarifyListPending,
  handleClarifySubmit,
} from "./api/clarify";
import { logError, logInfo, logMemory, withRequestLog } from "./log";
import { killAllTrackedAgentProcesses } from "./store/agent-process";
import { sweepDreamArtifacts } from "./store/dreams/cleanup";
import { housekeepTmpUploads } from "./store/memories/attachments";
import { registerEngramCronJobs } from "./scheduler";

try {
  await ensureEngramHome();
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  logError(`store ensure failed: ${msg}`);
  process.exit(1);
}
assertStoreStructureOrExit();
await loadClockFromDisk();

if (config.dreamCleanupOnStart) {
  await sweepDreamArtifacts();
}

if (config.attachmentHousekeepOnStart) {
  await housekeepTmpUploads();
}

registerEngramCronJobs();

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
  port: config.port,
  hostname: "127.0.0.1",
  routes: {
    "/": {
      GET: withRequestLog(() =>
        Response.json({
          name: "engram",
          endpoints: [
            "POST /activities",
            "POST /attachments/uploads",
            "GET /attachments/file",
            "DELETE /attachments/uploads/tmp",
            "POST /attachments/housekeep",
            "POST /dreams/run",
            "POST /dreams/retry",
            "POST /dreams/amend",
            "POST /dreams/cancel",
            "GET /dreams/pending",
            "PATCH /dreams/pending/node-score-involvements",
            "GET /dreams/events",
            "POST /dreams/approve",
            "POST /dreams/discard",
            "GET /memories/future-sight",
            "GET /memories/short-term-memory",
            "GET /memories/search",
            "GET /memories/chain",
            "GET /memories/chain/weeks",
            "GET /memories/chain/weeks/{week_id}",
            "GET /memories/chain/months",
            "GET /memories/chain/months/{month_id}",
            "GET /memories/chain/years",
            "GET /memories/chain/years/{year_id}",
            "GET /memories/chain/{day_id}",
            "GET /memories/nodes",
            "GET /memories/nodes/graph",
            "GET /memories/nodes/{node_id}",
            "GET /memories/clarify/asking",
            "GET /memories/clarify/pending",
            "POST /memories/clarify/asking/{id}/submit",
            "DELETE /memories/clarify/asking/{id}",
            "POST /memories/clarify/aside",
            "POST /memories/ask",
            "GET /memories/ask/recent",
            "GET /memories/ask/{job_id}",
            "POST /memories/ask/{job_id}/cancel",
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

    "/activities": {
      POST: withRequestLog(async (req) => {
        const body = (await req.json()) as {
          raw: string;
          source?: string;
          node_refs?: unknown;
          idempotency_key?: string;
          attachments?: { path: string; relationship: string }[];
        };
        const result = await handleActivities(body);
        if (result instanceof Response) return result;
        logInfo("capture ok", {
          event_id: result.event_id,
          source: body.source ?? "api",
          raw_len: body.raw?.length ?? 0,
        });
        return Response.json(result, { status: 201 });
      }),
    },

    "/attachments/uploads": {
      POST: withRequestLog(async (req) => handleUpload(req)),
    },

    "/attachments/file": {
      GET: withRequestLog(async (req) => handleGetFile(req)),
    },

    "/attachments/uploads/tmp": {
      DELETE: withRequestLog(async (req) => handleDeleteTmp(req)),
    },

    "/attachments/housekeep": {
      POST: withRequestLog(async () => handleHousekeep()),
    },

    "/dreams/run": {
      POST: withRequestLog(() => handleDreamRun()),
    },

    "/dreams/retry": {
      POST: withRequestLog(async (req) => {
        let body: { reason?: string; dream_run_id?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { reason?: string; dream_run_id?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleDreamRetry(body);
      }),
    },

    "/dreams/amend": {
      POST: withRequestLog(async (req) => {
        let body: { instruction?: string; dream_run_id?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { instruction?: string; dream_run_id?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleDreamAmend(body);
      }),
    },

    "/dreams/cancel": {
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

    "/dreams/pending": {
      GET: withRequestLog(() => handleDreamPending()),
    },

    "/dreams/pending/node-score-involvements": {
      PATCH: withRequestLog(async (req) => {
        let body: { id?: string; category?: string } = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text) as { id?: string; category?: string };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handlePatchNodeScoreInvolvements(body);
      }),
    },

    "/dreams/events": {
      GET: withRequestLog(async (req) => {
        const url = new URL(req.url);
        const runId = url.searchParams.get("run_id");
        const after = Number(url.searchParams.get("after") ?? "0");
        const result = await handleDreamEvents(runId, Number.isFinite(after) ? after : 0);
        if (result instanceof Response) return result;
        return Response.json(result);
      }),
    },

    "/dreams/approve": {
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

    "/dreams/discard": {
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

    "/memories/future-sight": {
      GET: withRequestLog(async () => {
        const body = await handleFutureSight();
        logInfo("future-sight", {
          anchors: (body as { anchors: unknown[] }).anchors.length,
          swept: (body as { swept_expired: unknown[] }).swept_expired.length,
        });
        return Response.json(body);
      }),
    },

    "/memories/short-term-memory": {
      GET: withRequestLog(async () => Response.json(await handleShortTermMemory())),
    },

    "/memories/search": {
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

    "/memories/chain": {
      GET: withRequestLog(async () => {
        const body = await handleChainIndex();
        logMemory("browse chain index", { days: body.days.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memories/chain/weeks": {
      GET: withRequestLog(async () => {
        const body = await handleWeekIndex();
        logMemory("browse chain weeks", { weeks: body.weeks.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memories/chain/months": {
      GET: withRequestLog(async () => {
        const body = await handleMonthIndex();
        logMemory("browse chain months", { months: body.months.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memories/chain/years": {
      GET: withRequestLog(async () => {
        const body = await handleYearIndex();
        logMemory("browse chain years", { years: body.years.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memories/nodes": {
      GET: withRequestLog(async () => {
        const body = await handleNodesIndex();
        logMemory("browse nodes index", { nodes: body.nodes.length, present: body.present });
        return Response.json(body);
      }),
    },

    "/memories/nodes/graph": {
      GET: withRequestLog(async () => {
        const body = await handleNodesGraph();
        logMemory("browse nodes graph", {
          nodes: body.nodes.length,
          edges: body.edges.length,
          present: body.present,
        });
        return Response.json(body);
      }),
    },

    "/memories/ask": {
      POST: withRequestLog(async (req) => {
        let body: { q?: string; include_later?: unknown } = {};
        try {
          body = (await req.json()) as { q?: string; include_later?: unknown };
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleMemoryAskPost(body);
      }),
    },

    "/memories/ask/recent": {
      GET: withRequestLog(async () => handleMemoryAskRecent()),
    },

    "/memories/clarify/asking": {
      GET: withRequestLog(async () => handleClarifyListAsking()),
    },

    "/memories/clarify/pending": {
      GET: withRequestLog(async () => handleClarifyListPending()),
    },

    "/memories/clarify/aside": {
      POST: withRequestLog(async (req) => {
        let body: unknown = {};
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        return handleClarifyAside(body);
      }),
    },
  },

  fetch: withRequestLog(async (req) => {
    const url = new URL(req.url);

    const weekMatch = url.pathname.match(/^\/memories\/chain\/weeks\/([^/]+)$/);
    if (weekMatch && req.method === "GET") {
      const weekId = decodeURIComponent(weekMatch[1]!);
      const out = await handleWeekDetail(weekId);
      if ("error" in out) {
        return Response.json(
          { error: out.error, message: "week_id must be YYYY-Www-MMDD (ISO week; MMDD = Monday)" },
          { status: 400 },
        );
      }
      logMemory("browse chain week", { week_id: out.week_id, present: out.present });
      return Response.json(out);
    }

    const monthMatch = url.pathname.match(/^\/memories\/chain\/months\/([^/]+)$/);
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

    const yearMatch = url.pathname.match(/^\/memories\/chain\/years\/([^/]+)$/);
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

    const chainMatch = url.pathname.match(/^\/memories\/chain\/([^/]+)$/);
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

    if (url.pathname === "/memories/nodes/graph" && req.method === "GET") {
      const body = await handleNodesGraph();
      logMemory("browse nodes graph", {
        nodes: body.nodes.length,
        edges: body.edges.length,
        present: body.present,
      });
      return Response.json(body);
    }

    const nodesMatch = url.pathname.match(/^\/memories\/nodes\/([^/]+)$/);
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

    const clarifySubmitMatch = url.pathname.match(
      /^\/memories\/clarify\/asking\/([^/]+)\/submit$/,
    );
    if (clarifySubmitMatch && req.method === "POST") {
      const id = decodeURIComponent(clarifySubmitMatch[1]!);
      let body: unknown = {};
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "invalid JSON body" }, { status: 400 });
      }
      return handleClarifySubmit(id, body);
    }

    const clarifyDismissMatch = url.pathname.match(/^\/memories\/clarify\/asking\/([^/]+)$/);
    if (clarifyDismissMatch && req.method === "DELETE") {
      const id = decodeURIComponent(clarifyDismissMatch[1]!);
      return handleClarifyDismiss(id);
    }

    const match = url.pathname.match(/^\/memories\/ask\/([^/]+)(\/cancel)?$/);
    if (match) {
      const jobId = decodeURIComponent(match[1]!);
      if (jobId === "recent" && req.method === "GET") {
        return handleMemoryAskRecent();
      }
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
    logError(`port ${config.port} already in use — stop other bun dev (lsof -t -iTCP:${config.port} -sTCP:LISTEN)`);
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
logInfo(`ENGRAM_STORE_DIR=${config.storeDir}`);
logInfo(`ENGRAM_TEMP_DIR=${config.tempDir}`);
logInfo(`ENGRAM_TZ=${config.timezone}`);
logInfo(`memory_language=${config.memoryLanguage}`);
logInfo(`ENGRAM_AGENT=${config.agentMode}`);
logInfo(`ENGRAM_ALLOW_VIRTUAL_CLOCK=${config.allowVirtualClock ? "1" : "0"}`);
logInfo(`dream_auto_approve=${config.dreamAutoApprove ? "true" : "false"}`);
