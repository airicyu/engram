/** Thin fetch wrapper for Engram `/api` proxy. */

export type ApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T;
};

export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
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
