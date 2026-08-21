# Integration patterns — copy-paste examples

← [SKILL.md](SKILL.md)

Replace `ENGRAM_URL` as needed. All examples use `POST /activities` only.

## curl

```bash
ENGRAM_URL="${ENGRAM_URL:-http://localhost:8787}"

curl -sS -X POST "$ENGRAM_URL/activities" \
  -H 'content-type: application/json' \
  -d '{"raw":"Deployed v1.2 to staging","source":"deploy-bot"}'
# → {"event_id":"e0000000042"}
```

Extract 進行中仍應得到 **201**（可能稍慢）。不要對 201 做 `dream_locked` backoff。

## Bun / TypeScript

```typescript
const ENGRAM_URL = process.env.ENGRAM_URL ?? "http://localhost:8787";

export async function captureActivity(
  raw: string,
  opts?: { source?: string },
): Promise<{ event_id: string }> {
  const res = await fetch(`${ENGRAM_URL}/activities`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      raw,
      source: opts?.source ?? "integration",
    }),
  });
  if (res.status === 201) return res.json();
  throw new Error(`capture failed ${res.status}: ${await res.text()}`);
}
```

## Python

```python
import os
import requests

ENGRAM_URL = os.environ.get("ENGRAM_URL", "http://localhost:8787")

def capture_activity(raw: str, source: str = "integration") -> dict:
    r = requests.post(
        f"{ENGRAM_URL}/activities",
        json={"raw": raw, "source": source},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

## Minimal webhook handler (Bun.serve)

```typescript
const ENGRAM_URL = process.env.ENGRAM_URL ?? "http://localhost:8787";

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    if (req.method !== "POST" || new URL(req.url).pathname !== "/hook") {
      return new Response("not found", { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const raw = typeof body?.text === "string" ? body.text : JSON.stringify(body);
    const res = await fetch(`${ENGRAM_URL}/activities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw, source: "webhook" }),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  },
});
```

## Batch import sketch

```bash
# One line per event in events.txt
while IFS= read -r line; do
  [ -z "$line" ] && continue
  post_activity "$line" "bulk-import"
  sleep 0.2  # gentle rate limit
done < events.txt
```

For day-scoped backfill with virtual clock, see `PUT /clock` in [api.md](../../../docs/api-docs/api.md) — integration-only, not typical production.
