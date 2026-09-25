# 0.4.0 — Engram store → Lite import（離線）

← [changelog](../../../changelog.md) · 上游：[0.3.3](../0.3.3/INDEX.md)（`shipped`）· current: [version.md](../../../version.md) · 寫法：[GUIDELINES](../GUIDELINES.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** `in progress`  
> **產品句：** 用**離線腳本**把既有 Engram 記憶庫**複製並轉形**到新的 Lite store（唯讀來源、只寫目標），讓使用者可切 `ENGRAM_LITE_STORE_DIR` 日常用 Lite，而不共用 `engram-data`。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | CLI、轉換表、旗標、測試 fixture |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不做 in-place、不搬 clarify／dream |
| 4 | [HANDOFF.md](./HANDOFF.md) | paste-ready 給實作 agent |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 入口 | `bun run scripts/import-from-engram.ts --from <engram-store> --to <lite-store>`；預設 **dry-run**；寫入需 `--yes`；目標非空需 `--force` |
| 2 | 來源 | 唯讀；**禁止** `--to` 指到 Engram 的 `engram-data` 或讓 Lite 與 Engram 共用一庫 |
| 3 | Chain | 以 Engram **`.summary.md`** 為正文；寫入 Lite **單檔**路徑（day／week `YYYY-Www-MMDD`／month／year）；不搬 ledger／`.md` 雙軌 |
| 4 | Nodes | `memories/nodes/**` 整棵複製；保留 Unicode id |
| 5 | Attachments | `memories/_attachments/**` 整棵複製 |
| 5b | 正文附圖 | 寫入 chain／nodes／pool `raw` 前 **正規化**為 `![[_attachments/uploads/{日}/{檔}]]`（把 Engram UI 烘焙的 `![](/api/attachments/file?path=…)` 轉回 wikilink，Obsidian 與 Engram 一致） |
| 6 | Future-sight | `memories/future-sight/upcoming.md`＋`longTerm.md` 複製（已存在則依旗標覆寫或跳過——見 HOW） |
| 7 | 未沉澱 | `memories/short-term-memory/pool.jsonl` → `memories/pool/pending.jsonl`；`id` 可重寫為 `evt_YYYYMMDD_xxxxxx`；`ts`／`raw` 保留；attachments 對稱依 Lite 校驗 |
| 8 | Workspace | `engram.workspace.yaml` → `workspace.yaml`（丟 `store_version`；映射 `future_sight_*` 若存在） |
| 9 | 不做 | `dreams/`、`memories/clarify/**`（第一版）；`activities/events.jsonl` 僅當 STM pool 空且 INDEX 修訂時才考慮 |
| 10 | 測試 | `mkdtemp` 虛構 mini Engram 目錄 fixture；**禁止**真人 vault 進 repo |
| 11 | Skill | 可選薄 skill：確認路徑、備份提醒、呼叫 script；**不**在 chat 手動 `mv` |

## 非目標

- HTTP `POST /migrate`、server 內建 import
- 自動改 Engram 來源庫、雙向同步
- Clarify／dream report 還原
- Import 後自動跑 distill

## 驗收

- [x] `--dry-run` 印出將複製／轉換的檔案數與範例路徑（無寫入）
- [x] 虛構 fixture 跑 `--yes` 後 Lite store 路徑與 pool `evt_*` 符合契約（`scripts/import-from-engram.test.ts`）
- [ ] Week 檔名為 `YYYY-Www-MMDD.md`；非法 legacy `YYYY-Www` 在 import 時升級
- [ ] Pool 列在 Lite `pending.jsonl` 可被 `POST /events` 對稱規則接受（或 document 跳過行）
- [ ] 文件：`docs/data-spec.md` 加「自 Engram 匯入」一節或指向本版 HOW
- [ ] `version.md`＝`0.4.0`（出貨時）

## 已定案（匯入策略，2026-09-25）

| # | 題 | 決定 |
|---|-----|------|
| 1 | Pool `id` | **一律重寫** `evt_YYYYMMDD_xxxxxx`（避免重複匯入碰撞） |
| 2 | 目標已有內容 | **預設拒絕**；`--force` **只補缺檔**（已存在路徑不覆寫；pool 可 append） |

## 錨點（預期）

`scripts/import-from-engram.ts`、`scripts/import-from-engram.test.ts`、`docs/data-spec.md`（匯入說明）、可選 `.agents/skills/engram-lite-import-from-engram/`

← [0.3.3](../0.3.3/INDEX.md) · [backlog](../backlog/INDEX.md)
