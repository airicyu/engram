/** HTTP handlers for memory ask jobs. */

import { startAskJob, cancelAskJob, getAskJobPayload, AskBusyError } from "../../seek/ask-run";
import { logInfo } from "../../log";

/** POST /memory/ask — start an asynchronous ask job. */
export async function handleMemoryAskPost(body: {
  q?: string;
  include_later?: unknown;
}): Promise<Response> {
  const q = body.q?.trim();
  if (!q) {
    return Response.json({ error: "missing_q", message: "Field q is required" }, { status: 400 });
  }

  if ("include_later" in body && body.include_later !== undefined) {
    if (typeof body.include_later !== "boolean") {
      return Response.json(
        {
          error: "invalid_include_later",
          message: "Field include_later must be a boolean (true or false)",
        },
        { status: 400 },
      );
    }
  }
  const include_later = body.include_later === true;

  try {
    const job_id = await startAskJob(q, { include_later });
    logInfo("memory ask started", { job_id, include_later });
    return Response.json(
      {
        job_id,
        status: "started",
        include_later,
        message: "Poll GET /memories/ask/{job_id} for progress and answer.",
      },
      { status: 202 },
    );
  } catch (e) {
    if (e instanceof AskBusyError) {
      return Response.json(
        { error: "ask_busy", message: "Another ask job is already running." },
        { status: 409 },
      );
    }
    throw e;
  }
}

/** GET /memory/ask/{job_id} — poll ask job status. */
export async function handleMemoryAskGet(jobId: string): Promise<Response> {
  const payload = await getAskJobPayload(jobId);
  return Response.json(payload);
}

/** POST /memory/ask/{job_id}/cancel — cancel a running ask job. */
export async function handleMemoryAskCancel(jobId: string): Promise<Response> {
  const job = await cancelAskJob(jobId);
  if (!job) {
    return Response.json({ present: false });
  }
  logInfo("memory ask cancelled", { job_id: jobId, status: job.status });
  return Response.json({ job_id: job.job_id, status: job.status });
}
