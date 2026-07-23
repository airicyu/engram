# 0.6.0 — Dream 可觀測性（run log + server log）

← [changelog](../../changelog.md) · 上游：[0.5.0](../0.5.0/INDEX.md) · current: [version](../../version.md)

> **狀態：** **已實作（0.6.0）** — 見 `version.md`／`changelog.md`。  
> **本版做：** 入夢（extract → materialize）過程的**結構化 run log**（可輪詢、可回看）+ **預設可見的 server console log**；Workbench Consolidate 畫面顯示進度與 log tail。  
> **本版不做：** agent stdout 全量串流、WebSocket、跨 run 的 log 搜尋 UI、Recall 改動。

## 產品句

> 按「入夢」後，使用者與開發者都能看見**現在卡在哪個 phase、agent 有沒有跑起來、materialize 進到哪**，而不是只有 lock +「入夢中」。

## 文件地圖

| 文件 | 內容 |
|------|------|
| [docs/dream-observability.md](./docs/dream-observability.md) | 事件模型、儲存、API、UI、server log 層級 |

## 現況痛點（0.5.0）

| 層 | 現況 | 問題 |
|----|------|------|
| Server | `logDream()` 有里程碑；`logAgentSpawn`／`logAgentResult` 走 `logDreamDebug`（需 `ENGRAM_DREAM_DEBUG=1`） | 接 live agent 時 console 幾乎沉默 |
| API | `dream-job.yaml` 只有 `phase: extract \| materialize \| pending_review` | 無逐步事件；UI 無法顯示細節 |
| UI | `lock` → 按鈕文案「入夢中」；poll `/status` 5s | 看不到 agent 是否在跑、跑了多久 |

## 已定案（2026-07-23）

| # | 題 | 決定 |
|---|-----|------|
| 1 | Run log 存哪 | `dream/runs/{dream_run_id}/events.jsonl`（append-only，一行一事件） |
| 2 | 事件格式 | `{ ts, level, phase, event, message?, detail? }`；`event` 為穩定機器名（如 `extract_start`、`agent_spawn`、`agent_finished`、`materialize_done`） |
| 3 | 讀取 API | **`GET /dream/events?run_id=&after=`** — `after` = 已收事件數（0-based offset）；回 `{ run_id, phase, status, events[], total }` |
| 4 | `/status` 捷徑 | `dream_job` 在 `running` 時附 **`log_tail`**（最近 N 條，預設 20），減少 UI 雙請求 |
| 5 | Phase 細化 | materialize 期間寫入子步驟（如 `materialize_patch` + `patch_id`／`type`） |
| 6 | Server console | agent spawn／finish／parse 結果**預設 info**（`logDream`）；完整 stdout preview 仍僅 debug |
| 7 | 保留期 | **supersede 舊 run 時保留舊 log**（audit）；approve 後亦保留；單 run 事件量有限 |
| 8 | UI | Consolidate：lock 時顯示 **phase + 經過時間 + 可捲動 log 列表**（poll `log_tail` 或 `/dream/events`） |
| 9 | 失敗 | `failed` job 保留 events + `error` 事件；UI 顯示最後訊息 |

## 非目標（本版）

- WebSocket／SSE 即時推播（poll 足夠）
- 把 agent 完整 stdout 寫進 jsonl（僅 preview + byte count）
- 獨立「Log 瀏覽器」場景或全文搜尋
- 改 dream 鎖定／approve 契約

## 實作軌道（建議順序）

1. `store/dream-events.ts` — append／read／tail
2. 在 `dream/run.ts`、agent runners、`materializeDraft` 埋點
3. `GET /dream/events` + `/status` 的 `log_tail`
4. 調整 `log.ts`／`extract-log.ts` 預設層級
5. Web Consolidate 進度區塊 + i18n
6. `api-docs/api.md`、`test:phases` 覆蓋 events API

## 與 0.7.0 的關係

兩版**獨立排程**；實作順序 **先做 0.6.0**。0.7.0 [Memory + Ask](../0.7.0/INDEX.md) 屆時**複製**本版 events 模式（`memory/ask/jobs/{id}/events.jsonl`），不阻塞 0.6.0 釋出。

---

**狀態：** shipped — 見 `version.md` 0.6.0
