import { failStuckRunning, listJobs, loadJob, newJobId, saveJob, type Job, type JobKind } from "./jobs.ts";
import { runSkillJob } from "./pi.ts";
import { port, storeDir, type ChainLevel } from "./paths.ts";
import { listChain, listNodes, readChain, readNode, readPool, readWorkspace, appendPending } from "./store.ts";

const webRoot = `${import.meta.dir}/../web`;

const queue: string[] = [];
let pumping = false;

async function enqueue(kind: JobKind, input: Record<string, string>): Promise<Job> {
  const job: Job = {
    id: newJobId(),
    kind,
    status: "queued",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input,
    output: null,
    error: null,
    log: ["queued"],
  };
  await saveJob(job);
  queue.push(job.id);
  void pump();
  return job;
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const id = queue.shift()!;
      const job = await loadJob(id);
      if (!job || job.status !== "queued") continue;
      job.status = "running";
      job.log.push("running");
      await saveJob(job);
      try {
        const text = await runSkillJob(job, (line) => {
          job.log.push(line);
        });
        job.status = "completed";
        job.output = { text };
        job.log.push("completed");
        await saveJob(job);
      } catch (err) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.log.push(`failed: ${job.error}`);
        await saveJob(job);
      }
    }
  } finally {
    pumping = false;
    if (queue.length) void pump();
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function isLevel(s: string): s is ChainLevel {
  return s === "day" || s === "week" || s === "month" || s === "year";
}

await failStuckRunning();

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "GET" && pathname === "/status") {
      const ws = await readWorkspace();
      const jobs = await listJobs();
      const active = jobs.find((j) => j.status === "running" || j.status === "queued") ?? null;
      return json({
        ok: true,
        store_dir: storeDir,
        timezone: ws.timezone,
        memory_language: ws.memory_language,
        pi_model: ws.pi_model,
        queue: active ? { job_id: active.id, kind: active.kind, status: active.status } : null,
      });
    }

    if (req.method === "GET" && pathname === "/pool") {
      return json(await readPool());
    }

    if (req.method === "GET" && pathname === "/chain") {
      const level = url.searchParams.get("level") ?? "day";
      if (!isLevel(level)) return json({ error: "invalid_level" }, 400);
      return json({ level, ids: await listChain(level) });
    }

    const chainOne = pathname.match(/^\/chain\/(day|week|month|year)\/([^/]+)$/);
    if (req.method === "GET" && chainOne) {
      const level = chainOne[1] as ChainLevel;
      const id = decodeURIComponent(chainOne[2]!);
      return json(await readChain(level, id));
    }

    if (req.method === "GET" && pathname === "/nodes") {
      return json({ nodes: await listNodes() });
    }

    const nodeOne = pathname.match(/^\/nodes\/([^/]+)$/);
    if (req.method === "GET" && nodeOne) {
      return json(await readNode(decodeURIComponent(nodeOne[1]!)));
    }

    if (req.method === "GET" && pathname === "/jobs") {
      const jobs = await listJobs();
      return json({
        jobs: jobs.map((j) => ({
          id: j.id,
          kind: j.kind,
          status: j.status,
          created_at: j.created_at,
          error: j.error,
        })),
      });
    }

    const jobOne = pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobOne) {
      const job = await loadJob(jobOne[1]!);
      if (!job) return json({ error: "not_found" }, 404);
      return json(job);
    }

    if (req.method === "POST" && pathname === "/events") {
      const body = (await req.json().catch(() => null)) as { raw?: string } | null;
      const raw = body?.raw?.trim() ?? "";
      if (!raw) return json({ error: "missing_raw" }, 400);
      const event = await appendPending(raw);
      return json({ event }, 200);
    }

    if (req.method === "POST" && pathname === "/distill") {
      const job = await enqueue("distill", {});
      return json({ job_id: job.id, status: job.status }, 202);
    }

    if (req.method === "POST" && pathname === "/ask") {
      const body = (await req.json().catch(() => null)) as { q?: string } | null;
      const q = body?.q?.trim() ?? "";
      if (!q) return json({ error: "missing_q" }, 400);
      const job = await enqueue("ask", { q });
      return json({ job_id: job.id, status: job.status }, 202);
    }

    if (req.method === "GET" && (pathname === "/" || pathname.startsWith("/web/"))) {
      const rel = pathname === "/" ? "index.html" : pathname.slice("/web/".length);
      const file = Bun.file(`${webRoot}/${rel}`);
      if (await file.exists()) {
        return new Response(file, { headers: { "Cache-Control": "no-store" } });
      }
      return json({ error: "not_found" }, 404);
    }

    return json({ error: "not_found" }, 404);
  },
});

console.log(`engram-lite  http://127.0.0.1:${server.port}  store=${storeDir}`);
