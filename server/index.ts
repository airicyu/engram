import { failStuckRunning, listJobs, loadJob, newJobId, saveJob, type Job, type JobKind } from "./jobs/index.ts";
import { runSkillJob } from "./worker/pi.ts";
import { isValidWeekId } from "./chain/time.ts";
import { countFutureSightAnchors, readFutureSightSettings, sweepFutureSight } from "./future-sight/index.ts";
import { port, storeDir, type ChainLevel } from "./config/paths.ts";
import { commitStore } from "./git/store-git.ts";
import { validateCreateMentionsInRaw } from "./nodes/mentions.ts";
import {
  listChain,
  listChainIndex,
  listNodes,
  readChain,
  readNode,
  readPool,
  readWorkspace,
  appendPending,
  appendPendingWithAttachments,
  searchMemories,
  listClarifyAsking,
  listClarifyPending,
  submitClarifyAnswer,
  dismissClarify,
  createClarifyAside,
  isValidClarifyId,
  saveAttachmentUpload,
  absAttachPath,
  mimeFromFilename,
  ALLOWED_ATTACH_MIME,
  MAX_ATTACH_BYTES,
  isValidAttachPath,
  buildNodeGraph,
  type AttachmentRef,
} from "./vault/index.ts";

const webRoot = `${import.meta.dir}/../web`;

const queue: string[] = [];
let pumping = false;

/** Reject stacked/parallel distill — one vault writer at a time. */
async function findActiveDistill(exceptId?: string): Promise<Job | null> {
  const jobs = await listJobs();
  return (
    jobs.find(
      (j) =>
        j.kind === "distill" &&
        (j.status === "queued" || j.status === "running") &&
        j.id !== exceptId,
    ) ?? null
  );
}

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
        console.log(`[job ${job.id}] start kind=${job.kind}`);
        const text = await runSkillJob(job, (line) => {
          job.log.push(line);
          console.log(`[job ${job.id}] ${line}`);
          // Persist mid-run so GET /jobs/:id shows progress (was only saved at end).
          void saveJob(job);
        });
        job.status = "completed";
        job.output = { text };
        job.log.push("completed");
        console.log(`[job ${job.id}] completed`);
        await saveJob(job);
        if (job.kind === "distill") {
          const git = await commitStore(storeDir, { op: "distill", id: job.id });
          if (git.warn) {
            job.log.push(git.warn);
            await saveJob(job);
          }
        }
      } catch (err) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.log.push(`failed: ${job.error}`);
        console.error(`[job ${job.id}] failed: ${job.error}`);
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
      const fsCounts = await countFutureSightAnchors();
      const fsSettings = await readFutureSightSettings();
      return json({
        ok: true,
        store_dir: storeDir,
        timezone: ws.timezone,
        memory_language: ws.memory_language,
        pi_model: ws.pi_model,
        future_sight_active_count: fsCounts.total,
        future_sight_upcoming_count: fsCounts.upcoming,
        future_sight_long_term_count: fsCounts.longTerm,
        future_sight_window_days: fsSettings.windowDays,
        future_sight_upcoming_days: fsSettings.upcomingDays,
        queue: active ? { job_id: active.id, kind: active.kind, status: active.status } : null,
      });
    }

    if (req.method === "GET" && pathname === "/future-sight") {
      const result = await sweepFutureSight(async (raw) => {
        await appendPending(raw);
      });
      if (result.changed) await commitStore(storeDir, { op: "future-sight" });
      return json({
        anchors: result.anchors.map((a) => ({
          id: a.id,
          zone: a.zone,
          anchor_start: a.anchor_start,
          anchor_end: a.anchor_end,
          content: a.content,
        })),
        swept_expired: result.swept_expired,
        future_sight_window_days: result.future_sight_window_days,
        future_sight_upcoming_days: result.future_sight_upcoming_days,
      });
    }

    if (req.method === "GET" && pathname === "/pool") {
      return json(await readPool());
    }

    if (req.method === "GET" && pathname === "/chain") {
      const level = url.searchParams.get("level") ?? "day";
      if (!isLevel(level)) return json({ error: "invalid_level" }, 400);
      const items = await listChainIndex(level);
      return json({ level, ids: items.map((i) => i.id), items });
    }

    const chainOne = pathname.match(/^\/chain\/(day|week|month|year)\/([^/]+)$/);
    if (req.method === "GET" && chainOne) {
      const level = chainOne[1] as ChainLevel;
      const id = decodeURIComponent(chainOne[2]!);
      if (level === "week" && !isValidWeekId(id)) return json({ error: "invalid_week_id" }, 400);
      return json(await readChain(level, id));
    }

    if (req.method === "GET" && pathname === "/nodes") {
      return json({ nodes: await listNodes() });
    }

    if (req.method === "GET" && pathname === "/nodes/graph") {
      return json(await buildNodeGraph());
    }

    const nodeOne = pathname.match(/^\/nodes\/([^/]+)$/);
    if (req.method === "GET" && nodeOne) {
      return json(await readNode(decodeURIComponent(nodeOne[1]!)));
    }


    if (req.method === "GET" && pathname === "/search") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return json({ error: "missing_q" }, 400);
      return json({ hits: await searchMemories(q) });
    }


    if (req.method === "GET" && pathname === "/clarify/asking") {
      return json({ items: await listClarifyAsking() });
    }

    if (req.method === "GET" && pathname === "/clarify/pending") {
      return json({ items: await listClarifyPending() });
    }

    const clarifySubmit = pathname.match(/^\/clarify\/asking\/([^/]+)\/submit$/);
    if (req.method === "POST" && clarifySubmit) {
      const id = decodeURIComponent(clarifySubmit[1]!);
      if (!isValidClarifyId(id)) return json({ error: "invalid_id" }, 400);
      const body = (await req.json().catch(() => null)) as { answer?: string } | null;
      const answer = body?.answer?.trim() ?? "";
      if (!answer) return json({ error: "missing_answer" }, 400);
      try {
        const result = await submitClarifyAnswer(id, answer);
        if (result.present) {
          await commitStore(storeDir, { op: "clarify-submit", id: result.id });
        }
        return json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "invalid_id") return json({ error: "invalid_id" }, 400);
        if (msg === "missing_answer") return json({ error: "missing_answer" }, 400);
        throw err;
      }
    }

    const clarifyDelete = pathname.match(/^\/clarify\/asking\/([^/]+)$/);
    if (req.method === "DELETE" && clarifyDelete) {
      const id = decodeURIComponent(clarifyDelete[1]!);
      if (!isValidClarifyId(id)) return json({ error: "invalid_id" }, 400);
      try {
        const result = await dismissClarify(id);
        if (result.present) {
          await commitStore(storeDir, { op: "clarify-dismiss", id: result.id });
        }
        return json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "invalid_id") return json({ error: "invalid_id" }, 400);
        throw err;
      }
    }

    if (req.method === "POST" && pathname === "/clarify/aside") {
      const body = (await req.json().catch(() => null)) as { raw?: string } | null;
      const raw = body?.raw?.trim() ?? "";
      if (!raw) return json({ error: "missing_raw" }, 400);
      try {
        const result = await createClarifyAside(raw);
        await commitStore(storeDir, { op: "clarify-aside", id: result.id });
        return json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "missing_raw") return json({ error: "missing_raw" }, 400);
        throw err;
      }
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
          input: j.input,
        })),
      });
    }

    const jobOne = pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobOne) {
      const job = await loadJob(jobOne[1]!);
      if (!job) return json({ error: "not_found" }, 404);
      return json(job);
    }

    if (req.method === "POST" && pathname === "/attachments") {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return json({ error: "invalid_form_data" }, 400);
      }
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) return json({ error: "missing_file" }, 400);
      const mime = (file as File).type || "";
      if (!ALLOWED_ATTACH_MIME.has(mime)) return json({ error: "invalid_mime" }, 400);
      if (file.size > MAX_ATTACH_BYTES) return json({ error: "file_too_large" }, 400);
      const candidate =
        file instanceof File && file.name?.trim() ? file.name.trim() : `upload`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      try {
        const result = await saveAttachmentUpload(bytes, candidate, mime);
        await commitStore(storeDir, { op: "attachment", id: result.path });
        return json(result, 201);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg === "invalid_mime" ||
          msg === "file_too_large" ||
          msg === "empty_file"
        ) {
          return json({ error: msg }, 400);
        }
        throw err;
      }
    }

    if (req.method === "GET" && pathname === "/attachments/file") {
      const rel = (url.searchParams.get("path") ?? "").trim();
      if (!rel || !isValidAttachPath(rel)) return json({ error: "invalid_path" }, 400);
      const abs = absAttachPath(rel);
      if (!abs) return json({ error: "invalid_path" }, 400);
      const f = Bun.file(abs);
      if (!(await f.exists())) return json({ error: "not_found" }, 404);
      const filename = rel.split("/").pop()!;
      return new Response(f, {
        headers: {
          "Content-Type": mimeFromFilename(filename),
          "Cache-Control": "no-store",
        },
      });
    }

    if (req.method === "POST" && pathname === "/events") {
      const body = (await req.json().catch(() => null)) as {
        raw?: string;
        attachments?: AttachmentRef[];
      } | null;
      const raw = body?.raw?.trim() ?? "";
      if (!raw) return json({ error: "missing_raw" }, 400);
      const liveIds = (await listNodes()).map((n) => n.id);
      const mentionCheck = validateCreateMentionsInRaw(raw, liveIds);
      if (!mentionCheck.ok) {
        if (mentionCheck.error === "mention_create_exists") {
          return json({ error: "mention_create_exists", id: mentionCheck.id }, 400);
        }
        return json({ error: "invalid_mention_id", bad_id: mentionCheck.bad_id }, 400);
      }
      try {
        const event = await appendPendingWithAttachments(raw, body?.attachments ?? null);
        await commitStore(storeDir, { op: "event", id: event.id });
        return json({ event }, 200);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const client = new Set([
          "missing_raw",
          "embed_alias",
          "invalid_embed",
          "invalid_attach_path",
          "missing_relationship",
          "asymmetric_attachments",
          "missing_file",
        ]);
        if (client.has(msg)) return json({ error: msg }, 400);
        throw err;
      }
    }

    if (req.method === "POST" && pathname === "/distill") {
      const active = await findActiveDistill();
      if (active) {
        console.warn(`[distill] rejected: active ${active.id} status=${active.status}`);
        return json(
          {
            error: "distill_already_active",
            job_id: active.id,
            status: active.status,
            message:
              "A distill job is already queued or running; refuse parallel/stacked distill to protect the vault.",
          },
          409,
        );
      }
      const job = await enqueue("distill", {});
      console.log(`[distill] accepted ${job.id}`);
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
