# Engram Web (0.10.0)

Vite + React + TypeScript workbench for **Activities → Consolidate → Seek → Memory**. Talks only to the HTTP API (never touches `ENGRAM_STORE_DIR`).

## Prerequisites

API server on `:8787`:

```bash
cd server
bun run start
```

## Dev

```bash
cd web
bun install
bun run dev
```

Open **http://localhost:8788** — Vite proxies `/api/*` → `ENGRAM_URL`.

## Production

```bash
cd web
bun run build
bun run start    # serves dist/ + /api proxy
```

Env: copy [`.env.example`](.env.example) → `.env`（皆可選）。

| Env | Default | Meaning |
|-----|---------|---------|
| `WEB_PORT` | `8788` | UI listen port |
| `ENGRAM_URL` | `http://localhost:8787` | Upstream API (proxied at `/api/*`) |

## Layout

- **`AppShell`** (`.app`) — fixed width for all scenes; shared `Topbar`
- Scene content swaps inside `main.stage` only (React state; no react-router in 0.10)

## Scenes

| Scene | What it does |
|-------|----------------|
| **Activities** (`activities`) | `POST /activities` · show L1 via `GET /memories/short-term-memory` |
| **Consolidate** | Dream → pending report → Approve／Discard／Cancel；`GET /status` |
| **Seek** | **Search** — `GET /memories/search?q=&scope=` · **Ask** — `POST /memories/ask` |
| **Memory** | **Day chain** — `GET /memories/chain` + detail · **Nodes** — `GET /memories/nodes` + detail (client filter) |

Status light polls `/status`: ~3s while lock／dreaming／ask，~20s during `pending_review`，~60s when idle.

## UI language

Shell strings — **繁體中文** (`zh-Hant`, default) and **English** (`en`). Topbar switcher persists to `localStorage` (`engram.locale`).

- Locale catalogs: `src/i18n/zh-Hant.json`, `src/i18n/en.json`
- **Not** translated: L1／L2／chain／dream report body, API error `message` text

## Source map

| Path | Role |
|------|------|
| `src/App.tsx` | AppShell + scene switch |
| `src/components/Topbar.tsx` | Brand, scenes, locale, status |
| `src/scenes/*` | Activities／Consolidate／Seek／Memory |
| `src/context/StatusContext.tsx` | `/status` poll |
| `src/lib/api.ts` | `/api` fetch helper |
| `server.ts` | Prod static + proxy |
