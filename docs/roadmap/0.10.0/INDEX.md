# 0.10.0 — Web Vite + React

← [changelog](../../../changelog.md) · 上游：[0.9.0](../0.9.0/INDEX.md) · current: [version](../../../version.md)

> **狀態：** **shipped（0.10.0）**

## 產品句

> Workbench 換成 Vite + React：共用 `AppShell` 固定寬度，四場景只換內容，方便之後加 UI。

## 定案

| 項目 | 定案 |
|------|------|
| 技術 | Vite + React + TypeScript（`web/`） |
| 殼 | `AppShell` 唯一寬度 `min(80rem, …)`；全場景一致 |
| 場景切換 | React state（不定 react-router） |
| API | 仍只打 `/api/*`；不改 server 契約 |
| i18n | 沿用 `zh-Hant`／`en` JSON |
| Dev | `bun run dev` → Vite `:8788` + proxy |
| Prod | `bun run build` → `dist/`；`bun run start` 靜態 + API proxy |

## 驗收

- [x] 四場景切換殼寬不變
- [x] Capture／Consolidate／Seek／Memory 遷至 React
- [x] locale、status poll
- [x] `AGENTS.md`／`web/README` 指令更新
- [x] `bun run build` 通過

## 錨點

| 路徑 | 角色 |
|------|------|
| `web/vite.config.ts` | Vite + `/api` proxy |
| `web/src/App.tsx` | AppShell + scene |
| `web/src/scenes/*` | 四場景 |
| `web/server.ts` | 服務 `dist/` + proxy |
