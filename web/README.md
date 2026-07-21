# Engram Web (0.2.0)

Minimal operator UI for **Capture → Consolidate → Recall**. Talks only to the HTTP API (never touches `ENGRAM_HOME`).

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
| **Capture** | `POST /ingest` · show today's L1 via `GET /activate` |
| **Consolidate** | `GET /status` · `POST /dream/run` with result summary |
| **Recall** | `GET /activate?q=` · L1 → day chain → nodes |

Status light polls `/status` (faster while `lock: true`). Capture is disabled during dream.
