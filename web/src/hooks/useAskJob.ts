import { useCallback, useEffect, useRef, useState } from "react";
import { engramApi, type ApiResult, type AskJob } from "../lib/api";
import { useStatus } from "../context/StatusContext";

const POLL_INTERVAL_MS = 2_500;

type AskStart = Pick<AskJob, "job_id" | "status" | "error" | "message">;

export function useAskJob() {
  const { status, askJobId, setAskJobId, askPolling, setAskPolling } = useStatus();
  const [progress, setProgress] = useState<AskJob | null>(null);
  const [answer, setAnswer] = useState<AskJob | null>(null);
  const [failure, setFailure] = useState<AskJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const mounted = useRef(false);
  const activeJobId = useRef<string | null>(null);
  const pollToken = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollController = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    pollToken.current += 1;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    pollController.current?.abort();
    pollController.current = null;
    activeJobId.current = null;
    setAskPolling(false);
  }, [setAskPolling]);

  const beginPolling = useCallback(
    (jobId: string, initialProgress?: AskJob) => {
      if (activeJobId.current === jobId) return;
      stopPolling();
      const token = ++pollToken.current;
      activeJobId.current = jobId;
      setAskJobId(jobId);
      setAskPolling(true);
      if (initialProgress && mounted.current) setProgress(initialProgress);

      const poll = async () => {
        if (!mounted.current || token !== pollToken.current) return;
        const controller = new AbortController();
        pollController.current = controller;
        try {
          const result = await engramApi.memories.askJob(jobId, { signal: controller.signal });
          if (!mounted.current || token !== pollToken.current) return;
          if (!result.ok || result.data.present === false) {
            setFailure(result.data);
            stopPolling();
            setAskJobId(null);
            return;
          }

          setProgress(result.data);
          if (result.data.status === "completed") {
            setAnswer(result.data);
            setFailure(null);
            setProgress(null);
            stopPolling();
            setAskJobId(null);
            return;
          }
          if (result.data.status === "failed" || result.data.status === "cancelled") {
            setFailure(result.data);
            setProgress(null);
            stopPolling();
            setAskJobId(null);
            return;
          }
          pollTimer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        } catch (error) {
          if ((error as DOMException).name === "AbortError" || !mounted.current || token !== pollToken.current) {
            return;
          }
          setFailure({ error: error instanceof Error ? error.message : "ask_poll_failed" });
          stopPolling();
          setAskJobId(null);
        }
      };

      void poll();
    },
    [setAskJobId, setAskPolling, stopPolling],
  );

  const start = useCallback(
    async (q: string, includeLater: boolean): Promise<ApiResult<AskStart>> => {
      stopPolling();
      setIsStarting(true);
      setAnswer(null);
      setFailure(null);
      try {
        const result = await engramApi.memories.ask({ q, include_later: includeLater });
        if (mounted.current && result.ok && result.data.job_id) {
          beginPolling(result.data.job_id);
        }
        return result;
      } finally {
        if (mounted.current) setIsStarting(false);
      }
    },
    [beginPolling, stopPolling],
  );

  const cancel = useCallback(async () => {
    const jobId = activeJobId.current ?? askJobId ?? status?.ask_job?.job_id;
    if (!jobId) return null;
    stopPolling();
    setAskJobId(null);
    setProgress(null);
    const result = await engramApi.memories.cancelAsk(jobId);
    if (mounted.current && !result.ok) setFailure(result.data);
    return result;
  }, [askJobId, setAskJobId, status?.ask_job?.job_id, stopPolling]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    const runningAsk = status?.ask_job;
    if (runningAsk?.status === "running" && runningAsk.job_id) {
      beginPolling(runningAsk.job_id, runningAsk);
    }
  }, [beginPolling, status?.ask_job]);

  return {
    start,
    cancel,
    progress,
    answer,
    failure,
    isActive: isStarting || askPolling || status?.ask_job?.status === "running",
  };
}
