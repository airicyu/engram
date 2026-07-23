# 0.7.0 — Recall Ask（非同步 AI 問答）

← [changelog](../../changelog.md) · 上游：[0.6.0](../0.6.0/INDEX.md) · current: [version](../../version.md)

> **狀態：** 規劃中 — 與 0.6.0 **獨立**；**實作順序在 0.6.0 之後**。  
> **本版做：** 在保留既有 **`GET /recall?q=`**（同步 keyword packet）前提下，新增 **非同步 AI 問答**：spawn agent 搜尋記憶脈絡、撰寫答案；job + events 可輪詢。  
> **本版不做：** embedding／向量庫、多輪對話 session、取代 sync recall、future-sight 注入（見 [backlog](../../backlog/recall-future-sight.md)）。

## 產品句

> **回憶**有兩條路：**快** — 關鍵字脈絡包（現行）；**深** — 丟問題給 AI，等它讀 L1／L2／chain 再回答（本版）。

## 文件地圖

| 文件 | 內容 |
|------|------|
| [docs/recall-ask.md](./docs/recall-ask.md) | job 生命週期、context、agent 契約、API、UI |

## 現況（0.5.0）

`GET /recall?q=` 同步回傳 packet；L2 匹配為 **keyword**（node id、L1 node_refs、`what.md` substring）。無 AI、無 timeout 問題，但也無法語意搜尋或綜合回答。

## 已定案（2026-07-23）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 與 sync recall 關係 | **並存**；`GET /recall` 行為不變 |
| 2 | 觸發 | **`POST /recall/ask`** body `{ "q": "…" }` → **202** `{ job_id, status: "started" }` |
| 3 | 輪詢 | **`GET /recall/ask/{job_id}`** → status、phase、answer、sources、log_tail |
| 4 | 執行模型 | 背景 task（同 dream）；**不**佔 dream lock（唯讀讀 store） |
| 5 | 並發 | **同時只允許一個 ask job**；新 ask → **409 `ask_busy`** |
| 6 | Context | 以 sync recall packet 為基礎；L2 廣度等細節 **實作前再討論** |
| 7 | Agent 輸出 | 結構化 JSON：`{ answer, sources[], confidence? }`；sources 對齊 packet 欄位 |
| 8 | 可觀測性 | 複製 0.6.0 模式：`recall/jobs/{job_id}/events.jsonl` + console log |
| 9 | Runner | 复用 `AgentRunner` 模式 + 新 prompt `prompts/recall-ask.md`；`ENGRAM_AGENT` 同 dream |
| 10 | UI | Recall 場景：**脈絡包**（現行）／**問答**（輸入 q → 進度 log → 答案 markdown） |
| 11 | Timeout | HTTP 不等待 agent；job `failed` + event 記錄；可設 `ENGRAM_ASK_TIMEOUT_MS` |

## 非目標（本版）

- 向量檢索、hybrid search
- Chat history／follow-up（一 job 一問）
- 自動寫入記憶（capture）
- Recall 注入 future-sight
- Server 端 streaming 答案（整包 JSON 完成後一次回）

## 實作軌道（建議順序）

1. `store/recall-job.ts` + `recall/jobs/{id}/job.yaml` + events（抄 0.6.0）
2. `recall/build-context.ts` — 組 agent context（擴展現有 `handleRecall`）
3. `agent/recall-ask.ts` + prompt
4. `POST /recall/ask`、`GET /recall/ask/:id`
5. Web Recall 問答 UI + i18n
6. `api-docs`、`test:phases`（mock agent 固定答案）

## 與 0.6.0 的關係

兩版**獨立**（可分開釋出）；**實作順序先做 0.6.0**。0.7.0 實作時複製 0.6.0 的 events 基礎設施，其餘細節（L2 廣度、舊 job 清理等）**開工前再討論**。

不依賴 mindzone／future-sight backlog。

---

**狀態：** draft — 核心並發策略已定；其餘實作前再定
