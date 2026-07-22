# 0.4.0 — 未來視

← [changelog](../../changelog.md) · 上游：[0.3.0](../0.3.0/INDEX.md) · current: [version](../../version.md)

> **狀態：** **已實作（0.4.0）** — 見 `version.md`／`changelog.md`。  
> Backlog：[mindzone](../backlog/near-future-mindzone.md) · [Recall 注入](../backlog/recall-future-sight.md)

## 文件地圖

| 文件 | 內容 |
|------|------|
| [docs/store-and-patch.md](./docs/store-and-patch.md) | 目錄、`future` patch、extract／report 分流 |
| [docs/expiry-and-api.md](./docs/expiry-and-api.md) | 過期＝L0/L1 event + 硬清；僅 `GET /future-sight` |
| [docs/impl-checklist.md](./docs/impl-checklist.md) | 實作順序 |

## 心智模型（已定）

| 前瞻類型 | 歸處 |
|----------|------|
| 近程、可錨定、會過期 | **未來視**（`future-sight/active/`） |
| 遠／含糊、黏 node | **node 認知**（本版只分流，不開新 facet） |
| 無錨無 node | **當日普通事件** |

## 已定做法要點

| # | 題 | 決定 |
|---|-----|------|
| 1 | 錨點粒度 | 日級／短區間；相對日 extract 當下收成絕對日 |
| 2 | 過期 | **L0（+L1）event → 硬清活檔**；懶掃；**無** expired 可 query |
| 3 | 遠景 → node | 只定 extract 分流；不開 `when.md` |
| 4 | mindzone | → backlog |
| 5 | 產品邊界 | 非日曆／待辦；非人生大尺度骨幹 |
| 6 | Recall | **不注入**未來視 |
| 7 | 存法 | 僅 `future-sight/active/{id}.md` |
| 8 | Patch | `future`；誤寫未來 `chain.id` 仍 `409 future_chain_id` |
| 9 | 讀取 API | **僅** `GET /future-sight` |

## 非目標（本版）

- mindzone、Recall 注入
- `when.md`、日曆 sync、提醒、過期 cron
- **`GET /future-sight/expired`**

---

**狀態：** implemented — 0.4.0 shipped — 2026-07-22
