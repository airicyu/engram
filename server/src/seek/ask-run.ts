/** Memory ask orchestration: background job + cancel. */

import { MockAskOkRunner } from "../agent/ask-mock";
import { MemoryAskCursorRunner } from "../agent/ask-cursor";
import { MemoryAskClaudeRunner } from "../agent/ask-claude";
import { killAskAgent } from "../agent/ask-process";
import type { MemoryAskRunner } from "../agent/ask-types";
import { computeDreamStatus } from "../dream/run";
import { config } from "../config";
import { emitAskEvent } from "./emit-ask-event";
import {
  makeAskJobId,
  writeAskJob,
  readAskJob,
  getRunningAskJob,
  updateAskJobPhase,
  pruneOldAskJobs,
  type AskJobState,
} from "../store/tmp/ask-job";
import { nowIso, calendarDate } from "../store/memories/activities";

/** Indicates another ask job is already running. */
export class AskBusyError extends Error {
  constructor() {
    super("another ask job is already running");
    this.name = "AskBusyError";
  }
}

/** Indicates the ask job was cancelled. */
export class AskCancelledError extends Error {
  job_id: string;
  constructor(jobId: string) {
    super("ask job cancelled");
    this.name = "AskCancelledError";
    this.job_id = jobId;
  }
}

const cancelledJobs = new Set<string>();

function pickAskRunner(): MemoryAskRunner {
  const mode = process.env.ENGRAM_AGENT ?? "claude";
  if (mode === "mock-ask-ok") return new MockAskOkRunner();
  if (mode === "cursor") return new MemoryAskCursorRunner();
  return new MemoryAskClaudeRunner();
}

export type StartAskJobOpts = {
  include_later?: boolean;
};

/** Start a new ask job (async). Returns job id immediately after persisting running state. */
export async function startAskJob(q: string, opts: StartAskJobOpts = {}): Promise<string> {
  const include_later = opts.include_later === true;
  const running = await getRunningAskJob();
  if (running) throw new AskBusyError();

  await pruneOldAskJobs();

  const jobId = makeAskJobId();
  const startedAt = nowIso();

  await writeAskJob({
    job_id: jobId,
    status: "running",
    q,
    include_later,
    started_at: startedAt,
    phase: "prepare",
    agent_pid: null,
    answer: null,
    sources: [],
    error: null,
  });

  emitAskEvent(jobId, {
    phase: "prepare",
    level: "info",
    event: "ask_start",
    message: "Ask job started",
    detail: { q, include_later },
  });

  void runAskJob(jobId, q, startedAt, include_later).catch(() => {});

  return jobId;
}

async function runAskJob(
  jobId: string,
  q: string,
  startedAt: string,
  include_later: boolean,
): Promise<void> {
  const dream_status = await computeDreamStatus();

  emitAskEvent(jobId, {
    phase: "prepare",
    level: "info",
    event: "store_map_ready",
    message: "Store map ready for agent",
    detail: { store_dir: config.storeDir, dream_status, include_later },
  });

  if (cancelledJobs.has(jobId)) {
    throw new AskCancelledError(jobId);
  }

  try {
    await updateAskJobPhase(jobId, "agent");
    emitAskEvent(jobId, {
      phase: "agent",
      level: "info",
      event: "agent_spawn",
      message: "Spawning ask agent",
    });

    const runner = pickAskRunner();
    const result = await runner.ask({
      job_id: jobId,
      q,
      store_dir: config.storeDir,
      timezone: config.timezone,
      memory_language: config.memoryLanguage,
      dream_status,
      now: nowIso(),
      today: calendarDate(),
      include_later,
    });

    if (cancelledJobs.has(jobId)) {
      throw new AskCancelledError(jobId);
    }

    await updateAskJobPhase(jobId, "parse");
    emitAskEvent(jobId, {
      phase: "parse",
      level: "info",
      event: "ask_parsed",
      message: "Answer parsed",
      detail: { sources: result.sources.length },
    });

    await writeAskJob({
      job_id: jobId,
      status: "completed",
      q,
      include_later,
      started_at: startedAt,
      completed_at: nowIso(),
      phase: "parse",
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence ?? null,
      error: null,
    });

    emitAskEvent(jobId, {
      phase: "parse",
      level: "info",
      event: "ask_complete",
      message: "Ask completed",
    });
  } catch (e) {
    if (e instanceof AskCancelledError || cancelledJobs.has(jobId)) {
      await finalizeCancelled(jobId, q, startedAt, include_later);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    emitAskEvent(jobId, {
      phase: "parse",
      level: "error",
      event: "ask_failed",
      message: msg,
    });
    await writeAskJob({
      job_id: jobId,
      status: "failed",
      q,
      include_later,
      started_at: startedAt,
      completed_at: nowIso(),
      phase: "parse",
      answer: null,
      sources: [],
      error: msg,
    });
  } finally {
    cancelledJobs.delete(jobId);
  }
}

async function finalizeCancelled(
  jobId: string,
  q: string,
  startedAt: string,
  include_later: boolean,
): Promise<void> {
  const existing = await readAskJob(jobId);
  emitAskEvent(jobId, {
    phase: "parse",
    level: "warn",
    event: "ask_cancelled",
    message: "Ask cancelled",
  });
  await writeAskJob({
    job_id: jobId,
    status: "cancelled",
    q,
    include_later: existing?.include_later ?? include_later,
    started_at: startedAt,
    completed_at: nowIso(),
    phase: existing?.phase ?? "agent",
    agent_pid: null,
    answer: null,
    sources: [],
    error: "cancelled by user",
  });
}

/** Cancel a running ask job. */
export async function cancelAskJob(jobId: string): Promise<AskJobState | null> {
  const job = await readAskJob(jobId);
  if (!job) return null;
  if (job.status !== "running") return job;

  cancelledJobs.add(jobId);
  killAskAgent(jobId, job.agent_pid);

  await finalizeCancelled(jobId, job.q, job.started_at, job.include_later === true);
  cancelledJobs.delete(jobId);
  return readAskJob(jobId);
}

/** Build poll payload for GET /memory/ask/{id}. */
export async function getAskJobPayload(jobId: string): Promise<object> {
  const job = await readAskJob(jobId);
  if (!job) return { present: false };

  const payload: Record<string, unknown> = { ...job, present: true };
  if (job.include_later == null) payload.include_later = false;
  if (job.status === "running") {
    const { tailAskEvents } = await import("../store/tmp/ask-events");
    payload.log_tail = await tailAskEvents(jobId, 20);
  }
  return payload;
}
