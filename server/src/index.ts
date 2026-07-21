import { config } from "./config";
import { ensureEngramHome } from "./store/home";
import { handleIngest } from "./api/ingest";
import { handleStatus } from "./api/status";
import { handleDreamRun } from "./api/dream";
import { handleActivate } from "./api/activate";
import { logError, logInfo, withRequestLog } from "./log";

await ensureEngramHome();

const server = Bun.serve({
  port: config.port,
  routes: {
    "/": {
      GET: withRequestLog(() =>
        Response.json({
          name: "engram",
          endpoints: [
            "POST /ingest",
            "POST /dream/run",
            "GET /activate",
            "GET /status",
          ],
        }),
      ),
    },

    "/status": {
      GET: withRequestLog(async () => Response.json(await handleStatus())),
    },

    "/ingest": {
      POST: withRequestLog(async (req) => {
        const body = (await req.json()) as {
          raw: string;
          source?: string;
          node_refs?: string[];
          idempotency_key?: string;
        };
        const result = await handleIngest(body);
        if (result instanceof Response) return result;
        logInfo("ingest ok", {
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

    "/activate": {
      GET: withRequestLog(async (req) => {
        const q = new URL(req.url).searchParams.get("q");
        const packet = await handleActivate(q);
        logInfo("activate", {
          q: packet.query,
          sources: packet.sources,
          nodes: packet.nodes.length,
          l1_present: packet.l1.present,
        });
        return Response.json(packet);
      }),
    },
  },

  fetch: withRequestLog(() =>
    Response.json({ error: "not found" }, { status: 404 }),
  ),

  error(error) {
    logError("unhandled", error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  },
});

logInfo(`engram listening on ${server.url}`);
logInfo(`ENGRAM_HOME=${config.engramHome}`);
logInfo(`ENGRAM_AGENT=${process.env.ENGRAM_AGENT ?? "cursor"}`);
