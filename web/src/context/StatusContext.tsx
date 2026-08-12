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

/** Only while extract／commit lock or local dreaming flag — not idle browsing. */
const ACTIVE_DREAM_POLL_MS = 3000;

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [dreaming, setDreaming] = useState(false);
  const [askPolling, setAskPolling] = useState(false);
  const [askJobId, setAskJobId] = useState<string | null>(null);
  const dreamPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // One-shot on mount (and if refreshStatus identity changes — rare).
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Poll /status only while a dream is actively running — not on idle／pending_review.
  const dreamActive = !!(dreaming || status?.lock || status?.dream_job?.status === "running");
  useEffect(() => {
    if (dreamPollTimer.current) {
      clearTimeout(dreamPollTimer.current);
      dreamPollTimer.current = null;
    }
    if (!dreamActive) return;

    let cancelled = false;
    const tick = () => {
      dreamPollTimer.current = setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          await refreshStatus();
          if (!cancelled) tick();
        })();
      }, ACTIVE_DREAM_POLL_MS);
    };
    tick();

    return () => {
      cancelled = true;
      if (dreamPollTimer.current) {
        clearTimeout(dreamPollTimer.current);
        dreamPollTimer.current = null;
      }
    };
  }, [dreamActive, refreshStatus]);

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
