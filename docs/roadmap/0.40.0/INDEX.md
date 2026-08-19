# 0.40.0 — 未來視 UI 翻閱＋zone upcoming／longTerm

← [changelog](../../../changelog.md) · 上游：[0.39.0](../0.39.0/INDEX.md)（in progress）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> 本版兩件事：（1）記憶頁第三 mode 瀏覽未來視；（2）廢 `hot`／`later`，改 `upcoming`／`longTerm`（檔名、`zone`、config 同形）。**有** store migrate；boot ≥ **0.40**。

## 產品句

> 人在記憶頁切到「未來視」，能像翻記憶鏈一樣掃即將／長遠錨點；分區名稱與檔名／API 一致為 upcoming／longTerm。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/ui.md](./docs/ui.md) | hash、mode 殼、列表／正文欄、空態 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何掛 Memory |
| 4 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |

相關：[0.36 IA](../0.36.0/docs/ia.md) · [GET future-sight](../../../api-docs/api.md) · migrate [0.36→0.40](../../../.agents/skills/engram-migration/migrate-0.36-to-0.40.md)

---

## 已定案

### A. 工作台未來視（原 UI 範圍）

| # | 題 | 決定 |
|---|-----|------|
| A1 | 掛哪 | Memory **第三 mode**；pills＝**記憶鏈｜節點｜未來視**。不要第五左欄。 |
| A2 | Hash | `#/memory/future`、`#/memory/future/{id}`；預設 `#/memory` 仍＝鏈。 |
| A3 | 版面 | 左列表＋右正文；分組標題即將／長遠獨佔一行；組內 API 近→遠。 |
| A4 | 取數 | `GET /memories/future-sight` 一次；無 detail 端點。 |
| A5 | Seek | Search／Ask `future_sight` 有 id 可點進同一 hash。 |

### B. Zone／檔名對齊（併入本版）

| # | 題 | 決定 |
|---|-----|------|
| B1 | zone | `upcoming`｜`longTerm`（廢 `hot`｜`later`） |
| B2 | 檔 | `memories/future-sight/upcoming.md`、`longTerm.md` |
| B3 | Config | `future_sight_upcoming_days`／`ENGRAM_FUTURE_SIGHT_UPCOMING_DAYS`（預設 30） |
| B4 | Status | `future_sight_upcoming_count`、`future_sight_long_term_count`、`future_sight_upcoming_days`；保留 `future_sight_active_count` |
| B5 | Migrate | hop `migrate-0.36-to-0.40`（准入 0.36–0.39；不丟 pending）；boot ≥ **0.40** |
| B6 | 語意 | 窗長／分桶規則不變；**longTerm ≠ L2 長期記憶**；中文即將／長遠 |

---

## 非目標

- 錨點編輯器、日曆／timeline、改窗長數字語意、第五左欄

## 驗收

- [x] `#/memory/future` 列出 upcoming 再 longTerm；點選右欄為該則 `content`
- [x] API／檔／prompt／UI 現行不用 `hot`／`later` 當 zone
- [x] `bun run test:phases` 全綠（含 hop 0.36→0.40）
- [x] version／changelog／AGENTS／backlog／migration skill 已對齊 0.40

## 與上一版對照

| | 0.39 | 0.40 |
|--|------|------|
| Memory modes | 鏈、節點 | ＋未來視 |
| 未來視 zone／檔 | `hot`／`later` | `upcoming`／`longTerm` |
| boot | ≥0.36 | ≥0.40 |
| migrate | — | `0.36→0.40` |
