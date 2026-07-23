/** Cancel a running dream job (stop + revert L1.5 artifacts). */

import { killAgentProcess } from "../store/agent-process";
import { readDreamJob, writeDreamJob } from "../store/dream-job";
import { removeDraft, listDreamRuns } from "../store/dream-runs";
import { writeExtractState } from "../store/extract-state";
import { releaseLock } from "../store/lock";
import { emitDreamEvent } from "./emit-event";
import { requestDreamCancel } from "./cancel-state";
import { nowIso } from "../store/events";

function dreamProcessKey(dreamRunId: string): string {
  return `dream:${dreamRunId}`;
}

async function resetExtractStateAfterCancel(): Promise<void> {
  const runs = await listDreamRuns();
  const committed = runs
    .filter((r) => r.status === "committed")
    .sort((a, b) => (a.committed_at ?? "").localeCompare(b.committed_at ?? ""));
  const last = committed[committed.length - 1];
  if (last) {
    await writeExtractState({ status: "ok", dream_run_id: last.id });
  } else {
    await writeExtractState({ status: "never" });
  }
}

/** Cancel the active running dream job. */
export async function cancelDream(opts?: {
  dream_run_id?: string;
}): Promise<{ dream_run_id: string; status: "cancelled" } | null> {
  const job = await readDreamJob();
  if (!job || job.status !== "running") return null;

  if (opts?.dream_run_id && opts.dream_run_id !== job.dream_run_id) {
    const err = new Error(
      `dream_run_id mismatch: expected ${job.dream_run_id}, got ${opts.dream_run_id}`,
    );
    err.name = "DreamRunMismatchError";
    throw err;
  }

  const dreamRunId = job.dream_run_id;

  requestDreamCancel(dreamRunId);
  killAgentProcess(dreamProcessKey(dreamRunId), job.agent_pid ?? null);

  await removeDraft(dreamRunId).catch(() => {});
  await resetExtractStateAfterCancel();

  emitDreamEvent(dreamRunId, {
    phase: job.phase ?? "extract",
    level: "warn",
    event: "dream_cancelled",
    message: "Dream cancelled by user",
  });

  await writeDreamJob({
    ...job,
    status: "cancelled",
    completed_at: nowIso(),
    agent_pid: null,
    error: "cancelled by user",
  });

  await releaseLock();

  return { dream_run_id: dreamRunId, status: "cancelled" };
}
