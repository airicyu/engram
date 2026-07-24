# 0.9.0 — Time Replay Event

← [changelog](../../changelog.md) · 上游：[0.8.0](../0.8.0/INDEX.md) · current: [version](../../version.md)

> **狀態：** **shipped（0.9.0）**

## 產品句

> 用**虛擬時鐘**重播過去一段時間的 mock events：當日記下 → 當晚入夢 → approve → 下一天。入夢 AI 與閘門都以為「今天」是模擬日，不是壁鐘。

## 定案

| 項目 | 定案 |
|------|------|
| 時間來源 | 單一 virtual clock；`nowIso`／`calendarDate` 無參皆讀它 |
| Capture `ts` | **不**開放 body `ts`；先 `PUT /clock` 再 capture |
| 閘 | `ENGRAM_ALLOW_VIRTUAL_CLOCK=1` 才允許 `PUT`；`DELETE` 恆可 |
| 持久化 | `ENGRAM_HOME/meta/clock.json` |
| AI | Extract／Ask context + prompt 注入 `today`／`now`；禁止用壁鐘 |
| Orchestrator | `bun run replay -- --fixture=…`（預設 auto-approve；`--pause` 可人工審） |
| UI | 本版不做時間機器 UI |

## 契約摘要

### `GET /clock`

```json
{ "mode": "system"|"virtual", "now": "…", "today": "YYYY-MM-DD", "timezone": "…", "allow_set": true }
```

### `PUT /clock`（需 env）

Body 二選一：

- `{ "now": "<ISO-8601 with offset>" }`
- `{ "day": "YYYY-MM-DD", "time?": "HH:mm:ss" }`（預設 `12:00:00`）

### `DELETE /clock`

回到 system clock，刪除 persistence。

### Fixture JSONL

```json
{"ts":"2026-05-12T14:20:00+08:00","raw":"…"}
```

`ts` = encoding 時間；`raw` = 記下內容。

### Replay 日循環

1. 該日每筆：`PUT /clock` → `POST /capture`
2. 撥到當晚（預設 `23:30`）或 `--dream-next-day` → `00:30`
3. `POST /dream/run` → pending → approve（或 `--pause`）

使用**獨立** `ENGRAM_HOME`，跑前 `reset`。

## 驗收

- [x] 虛擬日下 capture `ts`／dream「今天」／future 閘門一致
- [x] Extract context 含 `today`／`now`
- [x] `DELETE /clock` 回壁鐘；`/status.clock` 可見 mode
- [x] `test:phases` Phase 6 通過

## 錨點檔案

| 路徑 | 角色 |
|------|------|
| `server/src/store/clock.ts` | 虛擬時鐘 |
| `server/src/api/clock.ts` | HTTP |
| `server/src/cli/replay.ts` | Orchestrator |
| `server/fixtures/replay-sample.jsonl` | 樣例 |
| `server/prompts/extract.md` | `{{TODAY}}`／`{{NOW}}` |
