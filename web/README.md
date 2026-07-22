# Engram Web (0.3.0)

Minimal workbench UI for **Capture → Consolidate → Recall**. Talks only to the HTTP API (never touches `ENGRAM_HOME`).

## Prerequisites

API server on `:8787`:

```bash
cd server
bun run start
```

## Start UI

```bash
cd web
bun run start
```

Open **http://localhost:8788**

| Env | Default | Meaning |
|-----|---------|---------|
| `WEB_PORT` | `8788` | UI listen port |
| `ENGRAM_URL` | `http://localhost:8787` | Upstream API (proxied at `/api/*`) |

## Scenes

| Scene | What it does |
|-------|----------------|
| **Capture** | `POST /capture` · show L1 via `GET /recall` |
| **Consolidate** | Dream → pending report → Approve／Discard；`GET /status` |
| **Recall** | `GET /recall?q=` · L1 → day chain → nodes |

Status light polls `/status` (faster while `lock: true`). Capture is disabled only while the dream lock is held — **not** during `pending_review`.
