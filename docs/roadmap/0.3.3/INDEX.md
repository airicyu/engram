# 0.3.3 — Engram 對齊（讀寫契約，非 migrate）

← [changelog](../../../changelog.md) · 上游：[0.3.2](../0.3.2/INDEX.md)（`shipped`）· current: [version.md](../../../version.md) · [GUIDELINES](../GUIDELINES.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-25）  
> **產品句：** Lite 能**讀寫**與 Engram 相同形狀的週 id、Unicode node、future-sight zone 檔；離線 import 留 **[0.4.0](../0.4.0/INDEX.md)**。

## 本版範圍

| # | 題 | 決定 |
|---|-----|------|
| 1 | Week chain id | `YYYY-Www-MMDD`（`MMDD`＝週一）；路徑 `memories/chain/weeks/{週一YYYY-MM}/{id}.md` |
| 2 | Node id | 對齊 Engram：允許 Unicode；禁 `/`、`\`、`..` |
| 3 | Future-sight | `upcoming.md`＋`longTerm.md`；`GET /future-sight` expire-only→pending；search／ask／distill；UI `#/memory/future` |
| 4 | Engram import | **本版不做** → [0.4.0](../0.4.0/INDEX.md) |

## 非目標

- `dreams/`、`activities/events.jsonl` 雙軌 runtime
- Clarify 目錄搬移
- Future-sight GET 時 upcoming↔longTerm 重分桶
- Node score、`store_version`

## 驗收

- [x] `bun test` 含 week id、Unicode node graph、future-sight parse／sweep
- [x] `docs/data-spec.md`／`docs/api.md` 與實作一致
- [x] demo 週檔名為 `YYYY-Www-MMDD.md`
- [x] 記憶列表 `#/memory/future` 瀏覽 `GET /future-sight`
- [x] `version.md`＝`0.3.3`（出貨時）

## 錨點

`server/chain-time.ts`、`server/node-id.ts`、`server/future-sight.ts`、`server/paths.ts`、`server/store.ts`、`server/index.ts`、`web/app.js`、`docs/data-spec.md`

← [0.4.0](../0.4.0/INDEX.md) · [0.3.2](../0.3.2/INDEX.md) · [backlog](../backlog/INDEX.md)
