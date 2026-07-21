# 0.2.0 — Web UI

← [changelog](../../changelog.md) · current: [version](../../version.md) `0.2.0`

> **目標：** 在不改記憶契約的前提下，讓人能用瀏覽器走完 **Capture → Consolidate → Recall**，對齊 0.1.0 API。  
> **原則：** 先寫 plan、同意後再實作；UI 跟記憶循環走，不做後台 dashboard。

## 背景

0.1.0 已有可跑的 HTTP API（ingest / dream / activate / status），操作面主要靠 curl 與 operator skill。  
0.2.0 補上 **最小 web 界面**，降低「記一下／整理／想起來」的摩擦。

## 產品句（本版要驗證）

> 開網頁就能寫入記憶、看今日 L1、手動跑 dream、用關鍵字召回 context packet——且 dream 進行中不能誤寫入。

## 版面定案

### 整體

- **單欄工作台** + 輕量場景切換；不要厚側欄、不要首屏 stats 牆
- 頂部：`Engram` + 三場景 + **狀態燈**（來自 `/status`：`ok` / dreaming / `dream_incomplete` / `dead_letter_pending` / `never_dreamed`）
- 視覺：個人記憶本（閱讀／書寫為主），不是 admin console

### 三場景

| 場景 | API | 首屏職責 |
|------|-----|----------|
| **Capture**（預設） | `POST /ingest` + 讀 L1（via activate 或 status 後拼） | 大輸入寫 `raw`；送出後立刻顯示今日 L1 |
| **Consolidate** | `GET /status` + `POST /dream/run` | 回答「該不該夢」；主 CTA Run dream；顯示 lock / L1 / DLQ |
| **Recall** | `GET /activate?q=` | 搜尋 + 垂直閱讀：L1 → day chain → nodes `what` |

### 互動契約（對齊 API）

- `lock: true` → Capture 輸入禁用，說明「正在整理」
- ingest `409 dream_locked` → 友善錯誤，不靜默失敗
- dream `502` / `dream_incomplete` → Consolidate 提示可重試；L1 保留
- 不做：L0 event 表格當主角、多欄卡片牆、首屏塞 candidates/DLQ 詳情

## 範圍

### In scope（必須）

1. **靜態或輕量前端**，呼叫現有 `localhost:8787` API（同源 proxy 或可設定 `ENGRAM_URL`）
2. **Capture**：textarea + submit → `POST /ingest`；成功後刷新今日 L1 顯示
3. **Consolidate**：status 面板 + Run dream；顯示 `dream_run` 結果摘要（applied / DLQ / resumed）
4. **Recall**：query 輸入 + packet 三區塊渲染（markdown 純文字即可）
5. **狀態燈**：輪詢或操作後刷新 `/status`
6. **基本響應式**：手機可寫、可讀

### Out of scope（本版不做）

- Auth / 多租戶
- Candidates 批准建 node（仍手改 yaml）
- DLQ settlement UI
- 即時 streaming dream log
- Embedding 搜尋、graph 視覺化
- 新記憶契約或改 patch schema
- 美化到 marketing landing；本版是 **operator UI**

### 可選（時間夠再加）

- Capture 可選 `node_refs`（chip / 逗號分隔）
- Dream 進行中短輪詢 status 直到 `lock: false`
- 顯示 `event_id` / `dream_run_id` 方便對 log

## 技術建議（實作時再定死）

| 題 | 建議預設 | 備註 |
|----|----------|------|
| 放置位置 | `web/`（repo 根）或 `server` 靜態掛載 | 與 `server/` 記憶核心分開 |
| 棧 | 先 **vanilla / 極薄 React** 皆可 | 優先可維護與快出；避免重框架 |
| API 連線 | dev proxy → `:8787`；或 CORS + env base URL | 0.1.0 無 auth，僅本機假設 |
| Markdown | 後端已是 md 字串；前端用簡單 render 或 `<pre>` | 不必先上完整 editor |

### Tech lock

| 項 | 選定 |
|----|------|
| 目錄 | `web/`（repo 根） |
| 棧 | Vanilla HTML / CSS / JS |
| 服務 | Bun `Bun.serve({ routes })`：HTML import 掛 `/`，per-method `/api/*` proxy → `ENGRAM_URL`（預設 `:8787`） |
| API server | 同用 `routes` + method handlers（見 [Bun Server](https://bun.com/docs/runtime/http/server)） |
| Markdown | `<pre>` 純文字閱讀；不上 editor |
| 啟動 | `cd web && bun run start` → `http://localhost:8788` |

## 階段拆分

### Phase A — Shell + Capture

- App shell（頂欄、場景切換、狀態燈）
- Capture：ingest + 顯示 L1（可先 `GET /activate` 取 `l1`）
- Exit：瀏覽器寫兩筆 → `/status` 有 L1；dream lock 時 UI 禁用輸入

### Phase B — Consolidate

- Status 詳情 + Run dream
- 處理 409 / 502 / success 結果展示
- Exit：從 UI 跑完一輪 dream → L1 清空、狀態燈變 `ok`（或誠實標 DLQ）

### Phase C — Recall

- Activate 查詢與三區塊閱讀版面
- Exit：dream 前後各 recall 一次，能看出 L1→L2 切換

### Phase D — Polish（可砍）

- 輪詢、錯誤文案、`node_refs`、mobile 微調
- 更新 `changelog` / `version` → `0.2.0`；補 web 啟動說明到 README

## 驗收標準

- [x] 不開 curl，只開 web，能完成：ingest → dream → activate
- [x] dream 鎖定時無法 ingest，且有明確 UI 狀態
- [x] Recall 能顯示 L1 / chain / nodes，空狀態不崩潰
- [x] 不直接讀寫 `ENGRAM_HOME`；只打 HTTP API
- [x] `version.md` / `changelog.md` 在 release 時更新為 0.2.0

## 非目標檢查（避免膨脹）

若討論中出現下列需求，**另開 roadmap 條目**，不塞進 0.2.0：

- Approve candidates / settle DLQ
- Chat 對話式記憶助手
- 多使用者帳號
- Obsidian / 外部編輯器雙向同步

## 同意後才做

1. 鎖定 Tech（目錄 + 棧）寫入本檔「Tech lock」
2. 依 Phase A → B → C 實作；D 可砍
3. Release：更新 `version.md`、`changelog.md`

---

**狀態：** shipped — Tech lock 如下；Phase A–D 已落地於 `web/`。
