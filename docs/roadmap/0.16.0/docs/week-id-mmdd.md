# 0.16.0 補丁 — Week chain id 改為 `YYYY-Www-MMDD`

← [INDEX](../INDEX.md)

> **狀態：** 併入 0.16.0（正式對外 release 前追加；非另開小版本）。  
> **產品句：** Week block id 一眼看得出該週週一；browse API／UI 另回完整起迄日，不必把週日塞進 id。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Canonical week id | **`YYYY-Www-MMDD`**。例：`2026-W30-0720` |
| 2 | `Www` | ISO 8601 week number（1–53）；年為 **ISO week-year**（與 0.11 相同） |
| 3 | `MMDD` | **該週週一（Monday）** 的日曆月日（無連字號）。**不是**該週任意一天；非法／與 ISO 週一不符 → **`invalid_week_id`** |
| 4 | 起迄語意 | 週＝**週一～週日**（含）。結束日＝週一 +6；**不**寫進 id |
| 5 | 路徑 | 仍 `memories/chain/weeks/{YYYY-MM}/{week_id}.summary.md`；`{YYYY-MM}`＝**週一**所在日曆月（既有 `weekMonthKey`） |
| 6 | Browse API | Index／detail **必回** `start`／`end`（完整 `YYYY-MM-DD`，Mon／Sun）。合法 id 即使 `present: false` 也回（可由 id 推得） |
| 7 | Search／ask | Hit 的 `id` 用新格式；不強制在 search hit 重複 `start`／`end`（browse 已覆蓋） |
| 8 | 舊 id | `YYYY-Www`（無 `-MMDD`）**不再**合法；migrate／補丁腳本 rename 檔名＋`initialized_weeks.yaml` |
| 9 | UI | Memory week 列表／詳情展示 `start`–`end`（完整日期），不只顯示 id |

## 非法例

| id | 原因 |
|----|------|
| `2026-W30` | 缺 `-MMDD` |
| `2026-W30-0721` | `0721` 不是該週週一（應為 `0720`） |
| `2026-W30-0720-0726` | 禁止把迄日寫進 id |

## 跨年／跨月

- `2026-W01-1229`：ISO 年 2026、週一為 **2025-12-29**；`start=2025-12-29`，`end=2026-01-04`；資料夾 `2025-12/`。
- `2026-W31-0727`：跨月週末；`start=2026-07-27`，`end=2026-08-02`（迄日只在 API／UI，不在 id）。

## 驗收

- [x] `dayToWeekId`／檔名／`initialized_weeks` 皆為 `YYYY-Www-MMDD`
- [x] `GET /memories/chain/weeks` 與 `…/{week_id}` 含 `start`／`end`
- [x] 非法或 MMDD≠週一 → `400 invalid_week_id`
- [x] Memory UI week 層可見日期區間
- [x] 0.15→0.16 migrate（或等價 rename）把舊 `YYYY-Www.summary.md` 改為新檔名
- [x] api-docs／prompts 範例已換新 id
