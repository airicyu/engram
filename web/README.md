# Engram Web (0.10.0)

Vite + React + TypeScript workbench for **Events / Seek / Question inbox / Memory**. Talks only to the HTTP API (never touches `ENGRAM_STORE_DIR`).

若用 Obsidian 閱讀同一記憶庫：開啟 store 內的 **`memories/`** 作為 vault（不要開 store 根）。詳見 server／根 README（0.28+）。

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
| `WEB_PORT` | `8788` | UI listen port（**固定綁 `127.0.0.1`**；`http://localhost:8788` 可用） |
| `ENGRAM_URL` | `http://localhost:8787` | Upstream API (proxied at `/api/*`) |

## Layout

- **`AppShell`** (`.app`) — left sidebar + right stage
- Scene content swaps inside `main.stage` only (React state; no react-router in 0.10)

## Scenes

| Scene | What it does |
|-------|----------------|
| **Events** (`activities` + `consolidate`) | Compose `POST /activities` · Recent input `entries[]` · Consolidate dream review |
| **Seek** (`seek`) | **Search** — `GET /memories/search?q=&scope=` · **Ask** — `POST /memories/ask` |
| **Question inbox** (`clarify`) | Asking list + reply／dismiss · aside |
| **Memory** | **Chain** — `GET /memories/chain` + detail · **Nodes** — `GET /memories/nodes/graph` + `{id}` detail |

Status light polls `/status`: ~3s while lock／dreaming／ask，~20s during `pending_review`，~60s when idle.

## UI language

Shell strings — **繁體中文** (`zh-Hant`, default) and **English** (`en`). Sidebar switcher persists to `localStorage` (`engram.locale`).

- Locale catalogs: `src/i18n/zh-Hant.json`, `src/i18n/en.json`
- **Not** translated: short-term／L2／chain／dream report body, API error `message` text

## Source map

| Path | Role |
|------|------|
| `src/App.tsx` | AppShell + scene switch |
| `src/components/Sidebar.tsx` | Brand, nav, locale, status |
| `src/scenes/*` | Activities／Consolidate／Seek／Memory |
| `src/context/StatusContext.tsx` | `/status` poll |
| `src/lib/api.ts` | `/api` fetch helper |
| `server.ts` | Prod static + proxy |
