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

Retry on dream lock:

```bash
post_activity() {
  local raw="$1" source="${2:-api}"
  local attempt=0 max=5
  while [ "$attempt" -lt "$max" ]; do
    code=$(curl -sS -o /tmp/engram-resp.json -w '%{http_code}' \
      -X POST "$ENGRAM_URL/activities" \
      -H 'content-type: application/json' \
      -d "$(jq -n --arg r "$raw" --arg s "$source" '{raw:$r, source:$s}')")
    if [ "$code" = "201" ]; then cat /tmp/engram-resp.json; return 0; fi
    if [ "$code" = "409" ]; then sleep $((30 + attempt * 15)); attempt=$((attempt+1)); continue; fi
    cat /tmp/engram-resp.json >&2; return 1
  done
  echo "dream_locked: gave up after $max retries" >&2; return 1
}
```

## Bun / TypeScript

```typescript
const ENGRAM_URL = process.env.ENGRAM_URL ?? "http://localhost:8787";

export async function captureActivity(
  raw: string,
  opts?: { source?: string; node_refs?: string[] },
): Promise<{ event_id: string }> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${ENGRAM_URL}/activities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raw,
        source: opts?.source ?? "integration",
        ...(opts?.node_refs ? { node_refs: opts.node_refs } : {}),
      }),
    });
    if (res.status === 201) return res.json();
    if (res.status === 409) {
      await Bun.sleep(30_000 + attempt * 15_000);
      continue;
    }
    throw new Error(`capture failed ${res.status}: ${await res.text()}`);
  }
  throw new Error("capture failed: dream_locked (retries exhausted)");
}
```

## Python

```python
import os
import time
import requests

ENGRAM_URL = os.environ.get("ENGRAM_URL", "http://localhost:8787")

def capture_activity(raw: str, source: str = "integration") -> dict:
    for attempt in range(5):
        r = requests.post(
            f"{ENGRAM_URL}/activities",
            json={"raw": raw, "source": source},
            timeout=30,
        )
        if r.status_code == 201:
            return r.json()
        if r.status_code == 409:
            time.sleep(30 + attempt * 15)
            continue
        r.raise_for_status()
    raise RuntimeError("dream_locked: retries exhausted")
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
