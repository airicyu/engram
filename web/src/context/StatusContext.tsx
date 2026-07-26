import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { Pending, Status } from "../lib/types";

type StatusContextValue = {
  status: Status | null;
  pending: Pending | null;
  dreaming: boolean;
  setDreaming: (v: boolean) => void;
  askPolling: boolean;
  setAskPolling: (v: boolean) => void;
  askJobId: string | null;
  setAskJobId: (id: string | null) => void;
  refreshStatus: () => Promise<boolean>;
  refreshPending: () => Promise<void>;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [dreaming, setDreaming] = useState(false);
  const [askPolling, setAskPolling] = useState(false);
  const [askJobId, setAskJobId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dreamingRef = useRef(dreaming);
  dreamingRef.current = dreaming;

  const refreshPending = useCallback(async () => {
    const { ok, data } = await api<Pending>("/dreams/pending");
    if (!ok) {
      setPending(null);
      return;
    }
    setPending(data);
  }, []);

  const refreshStatus = useCallback(async () => {
    const { ok, data } = await api<Status & { error?: string }>("/status");
    if (!ok || data?.error === "engram_unreachable") {
      setStatus(null);
      setPending(null);
      return false;
    }
    setStatus(data);
    if (dreamingRef.current && !data.lock && data.dream_job?.status !== "running") {
      setDreaming(false);
    }
    if (data.dream_status === "pending_review" || data.dream_status === "l1_clear_pending") {
      await refreshPending();
    } else {
      setPending({ present: false });
    }
    return true;
  }, [refreshPending]);

  const schedulePoll = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    const locked = !!(status?.lock || dreaming);
    const pendingReview = status?.dream_status === "pending_review";
    const asking = !!status?.ask_job || askPolling;
    const ms = locked || asking ? 3000 : pendingReview ? 20000 : 60000;
    pollTimer.current = setTimeout(() => {
      void refreshStatus();
    }, ms);
  }, [status, dreaming, askPolling, refreshStatus]);

  useEffect(() => {
    void refreshStatus();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refreshStatus]);

  useEffect(() => {
    schedulePoll();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [schedulePoll]);

  const value = useMemo(
    () => ({
      status,
      pending,
      dreaming,
      setDreaming,
      askPolling,
      setAskPolling,
      askJobId,
      setAskJobId,
      refreshStatus,
      refreshPending,
    }),
    [
      status,
      pending,
      dreaming,
      askPolling,
      askJobId,
      refreshStatus,
      refreshPending,
    ],
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus outside provider");
  return ctx;
}
