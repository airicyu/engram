# 0.3.3 — Engram 對齊（讀寫契約，非 migrate）

← [changelog](../../../changelog.md) · 上游：[0.3.2](../0.3.2/INDEX.md)（`shipped`）· [GUIDELINES](../GUIDELINES.md)

> **狀態：** `in progress`  
> **產品句：** 讓 Lite 能**讀寫**與 Engram 相同形狀的週 id、Unicode node、future-sight zone 檔；**之後**才做離線 `engram-data` → Lite import（clarify／dream 不在第一版 migrate 範圍）。

## 本版範圍

| # | 題 | 決定 |
|---|-----|------|
| 1 | Week chain id | `YYYY-Www-MMDD`（`MMDD`＝週一）；路徑 `memories/chain/weeks/{週一YYYY-MM}/{id}.md` |
| 2 | Node id | 對齊 Engram：允許 Unicode；禁 `/`、`\`、`..` |
| 3 | Future-sight | `memories/future-sight/upcoming.md`＋`longTerm.md`；`GET /future-sight` expire-only→pending；search／ask／distill 契約 |
| 4 | Engram import | **本版不做**。規格見 [backlog/engram-import.md](../backlog/engram-import.md) |

## 非目標

- `dreams/`、`activities/events.jsonl` 雙軌 runtime（import 時才一次性轉進 `pool/pending.jsonl`）
- Clarify 目錄搬移
- Future-sight GET 時 upcoming↔longTerm 重分桶（Engram full maintain 留給 distill／日後）
- Node score、`store_version`

## 驗收

- [ ] `bun test` 含 week id、Unicode node graph、future-sight parse／sweep
- [ ] `docs/data-spec.md`／`docs/api.md` 與實作一致
- [ ] demo 週檔名為 `YYYY-Www-MMDD.md`

## 之後（backlog）

[Engram → Lite import](../backlog/engram-import.md)：chain（summary→單檔）、nodes、attachments、future-sight、**STM `pool.jsonl`→pending**；略過 clarify、dream。
