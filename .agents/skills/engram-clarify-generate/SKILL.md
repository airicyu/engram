---
name: engram-clarify-generate
description: 在 distill 沉澱之後，於 memories/clarify/asking/ 依缺口新建 0–5 道釐清題（5 是上限）。由 program 在獨立 Pi session 呼叫；不要單獨當日常沉澱入口。
---

# 釐清生題（獨立 session）

契約：[`docs/roadmap/0.9.0/INDEX.md`](../../../docs/roadmap/0.9.0/INDEX.md)（0–5，5 是上限）。0.3.0 已定案 #5 的下限與 retry 不再適用。  
調度：[`docs/architecture/orchestration.md`](../../../docs/architecture/orchestration.md)——**program 開獨立 session**；本 skill 只負責判斷「問什麼」。

記憶庫：`ENGRAM_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-data`）。

## 何時跑

- **只**由 `POST /distill` 的 program 編排：在 `engram-distill` **成功且開始前有可沉澱 work** 之後，**另開一次** Pi session 執行。
- Distill 早退（開始前 pool＋clarify pending 皆空）→ program **整段跳過**本 skill。
- Server／ingest／`POST /events`／Ask **永不**呼叫本 skill。
- 沒有為了補題而重跑的 session。本輪新建超過 5 題，或 0 題且回覆是空白，program 會讓 job 失敗。

## 步驟

Vault＝`{store}/memories/`。

1. 讀 `{store}/workspace.yaml`（時區、語言）。
2. 讀本批剛沉澱的 day／相關 nodes（及事件摘要）；不要無節制掃全庫。
3. 列出現有 `clarify/asking/`（及 pending）題目，避免重複。
4. 只在確有可問缺口時，於 `memories/clarify/asking/` 新建 **1–5** 檔。5 是上限。一題只問一個能寫進某個 day 或某個 node 的事實（誰、何時、是否、一個數字或一個決定）。題幹可以點出已知上下文，問句只有一個。語言跟 `memory_language`。
5. 沒有新事件缺口，也沒有未解的節點矛盾時，**不要寫檔**。回覆只留一句原因。不要為了湊數而出題，不要同義灌水。
6. 鏈、節點或 `clarify/history/` 裡已經答過的缺口不要再問。半答留下的那一個事實，若仍出現在鏈或節點上，可以另開一題，且不得複製舊題幹來蒐集沒答的子句。

### 檔格式

```markdown
---
id: cla_YYYYMMDD_xxxxxx
ts: <RFC3339 當地>
---

（一事一問的問題正文）
```

`id`＝`cla_`＋當地 `YYYYMMDD`＋`_`＋6 位小寫字母數字。檔名＝`{id}.md`。

## 禁止

- 不要改 chain／nodes／pool
- 不要預寫答案進 asking
- 不要為了湊滿題數而把兩個事實寫進同一題，也不要在沒有缺口時硬出題
- 不要讀 `jobs/`，不要把缺日清單當出題材料，不要問「某日有沒有值得記的事」

## 回覆

有新建時：列出 asking id（1–5 個）與各題一行摘要。0 題時：只寫一句為什麼這次沒有可問的缺口。短。
