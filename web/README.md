# Engram Web (0.8.0)

Minimal workbench UI for **Capture → Consolidate → Seek → Memory**. Talks only to the HTTP API (never touches `ENGRAM_HOME`).

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

Env: copy [`.env.example`](./.env.example) → `.env`（Bun 會自動載入；皆可選）。

| Env | Default | Meaning |
|-----|---------|---------|
| `WEB_PORT` | `8788` | UI listen port |
| `ENGRAM_URL` | `http://localhost:8787` | Upstream API (proxied at `/api/*`) |

## Scenes

| Scene | What it does |
|-------|----------------|
| **Capture** | `POST /capture` · show L1 via `GET /memory/l1` |
| **Consolidate** | Dream → pending report → Approve／Discard／Cancel；`GET /status` |
| **Seek** | **Search** — `GET /memory/search?q=&scope=` · **Ask** — `POST /memory/ask` |
| **Memory** | **Day chain** — `GET /memory/chain` + detail · **Nodes** — `GET /memory/nodes` + detail (client filter) |

Status light polls `/status`: **5s** while lock／dreaming，**20s** during `pending_review`，**60s** when idle. Capture is disabled only while the dream lock is held — **not** during `pending_review`.

Memory scene uses a wider shell (`.app-wide`, up to ~80rem) and a split index／detail layout (`≥48rem`).

## UI language

Shell strings only — **繁體中文** (`zh-Hant`, default) and **English** (`en`). Topbar switcher persists to `localStorage` (`engram.locale`).

- Locale catalogs: `i18n/zh-Hant.json`, `i18n/en.json`
- **Not** translated: L1／L2／chain／dream report body, API error `message` text
- Status grid `dt` keys (`dream_status`, `lock`, …) stay as API identifiers; advice／labels are localized
