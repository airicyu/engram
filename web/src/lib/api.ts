/** Typed client for the Engram `/api` proxy. */

import type { Pending, Status } from "./types";

export type ApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T;
};

export type ApiOptions = RequestInit;

export async function api<T = Record<string, unknown>>(
  path: string,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let data = null as T;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = { error: text } as T;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

export type SearchScope = "l1" | "nodes" | "chain" | "future";

export type MemorySearch = {
  l1?: { entries?: Array<{ id: string; ts: string; raw: string }> } | null;
  chain?: Array<{ day_id?: string; id?: string; content: string }>;
  nodes?: Array<{ node: string; match_reason?: string; understanding?: string }>;
  future_sight?: Array<{
    id: string;
    zone: string;
    anchor_start?: string;
    anchor_end?: string;
    content?: string;
    match_reason?: string;
  }>;
  message?: string;
  error?: string;
};

export type AskJob = {
  job_id?: string;
  present?: boolean;
  status?: "running" | "completed" | "failed" | "cancelled" | string;
  phase?: string;
  started_at?: string;
  answer?: string;
  sources?: unknown[];
  error?: string;
  message?: string;
  log_tail?: Array<{ ts?: string; event?: string; message?: string; level?: string }>;
};

export type ChainLevel = "day" | "week" | "month" | "year";
export type ChainDetail = {
  present?: boolean;
  source?: string;
  content?: string;
  start?: string;
  end?: string;
  message?: string;
  error?: string;
};
export type ChainIndex = {
  present?: boolean;
  days?: Array<{ day_id: string; preview?: string }>;
  weeks?: Array<{ week_id: string; start?: string; end?: string; preview?: string }>;
  months?: Array<{ month_id: string; preview?: string }>;
  years?: Array<{ year_id: string; preview?: string }>;
  message?: string;
  error?: string;
};
export type NodeIndex = {
  node: string;
  preview?: string;
  score?: number | null;
  display_score?: number | null;
};
export type NodeDetail = {
  present?: boolean;
  understanding?: string;
  display_score?: number | null;
  score?: number | null;
  score_timestamp?: string | null;
  message?: string;
  error?: string;
};

export type ClarifyAskingItem = {
  id: string;
  kind: "prompt";
  created_at: string;
  source_dream_run_id: string | null;
  related_nodes: string[];
  question: string;
};

function encoded(id: string): string {
  return encodeURIComponent(id);
}

export const engramApi = {
  activities: {
    create: (
      body: { raw: string; source?: string; attachments?: { path: string; relationship: string }[] },
      options?: ApiOptions,
    ) => api<{ event_id?: string; error?: string; message?: string }>("/activities", {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),
  },
  attachments: {
    upload: (file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      return api<{ path?: string; day?: string; filename?: string; error?: string; message?: string }>(
        "/attachments/uploads",
        { method: "POST", body: formData, headers: {} },
      );
    },
    deleteTmp: (day: string, filename: string) =>
      api<{ deleted?: boolean; error?: string }>(
        `/attachments/uploads/tmp?day=${encodeURIComponent(day)}&filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      ),
  },
  dreams: {
    run: (options?: ApiOptions) =>
      api<{ job_id?: string; message?: string; error?: string }>("/dreams/run", {
        ...options,
        method: "POST",
      }),
    pending: (options?: ApiOptions) => api<Pending>("/dreams/pending", options),
    approve: (options?: ApiOptions) =>
      api<Record<string, unknown> & { message?: string; error?: string }>("/dreams/approve", {
        ...options,
        method: "POST",
        body: "{}",
      }),
    discard: (options?: ApiOptions) =>
      api<{ message?: string; error?: string }>("/dreams/discard", {
        ...options,
        method: "POST",
        body: "{}",
      }),
    retry: (
      body: { reason: string; dream_run_id?: string },
      options?: ApiOptions,
    ) => api<{ job_id?: string; message?: string; error?: string }>("/dreams/retry", {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),
    amend: (
      body: { instruction: string; dream_run_id?: string },
      options?: ApiOptions,
    ) => api<{ job_id?: string; message?: string; error?: string }>("/dreams/amend", {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),
    cancel: (options?: ApiOptions) =>
      api<{ message?: string; error?: string }>("/dreams/cancel", {
        ...options,
        method: "POST",
        body: "{}",
      }),
  },
  memories: {
    search: (
      { q, scope }: { q: string; scope?: SearchScope[] },
      options?: ApiOptions,
    ) => {
      const params = new URLSearchParams({ q });
      if (scope?.length) params.set("scope", scope.join(","));
      return api<MemorySearch>(`/memories/search?${params}`, options);
    },
    ask: (body: { q: string }, options?: ApiOptions) => api<AskJob>("/memories/ask", {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),
    askJob: (jobId: string, options?: ApiOptions) =>
      api<AskJob>(`/memories/ask/${encoded(jobId)}`, options),
    cancelAsk: (jobId: string, options?: ApiOptions) =>
      api<AskJob>(`/memories/ask/${encoded(jobId)}/cancel`, {
        ...options,
        method: "POST",
        body: "{}",
      }),
    chain: {
      index: (level: ChainLevel, options?: ApiOptions) =>
        api<ChainIndex>(
          level === "day"
            ? "/memories/chain"
            : `/memories/chain/${level === "week" ? "weeks" : `${level}s`}`,
          options,
        ),
      detail: (level: ChainLevel, id: string, options?: ApiOptions) =>
        api<ChainDetail>(
          level === "day"
            ? `/memories/chain/${encoded(id)}`
            : `/memories/chain/${level === "week" ? "weeks" : `${level}s`}/${encoded(id)}`,
          options,
        ),
    },
    nodes: {
      index: (options?: ApiOptions) => api<{ present?: boolean; nodes?: NodeIndex[] }>("/memories/nodes", options),
      detail: (id: string, options?: ApiOptions) =>
        api<NodeDetail>(`/memories/nodes/${encoded(id)}`, options),
    },
    clarify: {
      listAsking: (options?: ApiOptions) =>
        api<{ items?: ClarifyAskingItem[]; error?: string; message?: string }>(
          "/memories/clarify/asking",
          options,
        ),
      submit: (id: string, body: { answer: string }, options?: ApiOptions) =>
        api<{ id?: string; queue?: string; error?: string; message?: string }>(
          `/memories/clarify/asking/${encoded(id)}/submit`,
          { ...options, method: "POST", body: JSON.stringify(body) },
        ),
      dismiss: (id: string, options?: ApiOptions) =>
        api<{ ok?: boolean; error?: string; message?: string }>(
          `/memories/clarify/asking/${encoded(id)}`,
          { ...options, method: "DELETE" },
        ),
      aside: (body: { raw: string }, options?: ApiOptions) =>
        api<{ id?: string; queue?: string; error?: string; message?: string }>(
          "/memories/clarify/aside",
          { ...options, method: "POST", body: JSON.stringify(body) },
        ),
    },
  },
  status: (options?: ApiOptions) => api<Status & { error?: string }>("/status", options),
};
