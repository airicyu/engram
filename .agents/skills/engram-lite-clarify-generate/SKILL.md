---
name: engram-lite-clarify-generate
description: 在 distill 沉澱之後，於 memories/clarify/asking/ 強制新建 3–5 道釐清題（對齊 Engram runClarifyGenerate 配額）。由 program 在獨立 Pi session 呼叫；不要單獨當日常沉澱入口。
---

# 釐清生題（獨立 session）

契約：[`docs/roadmap/0.3.0/INDEX.md`](../../../docs/roadmap/0.3.0/INDEX.md) 已定案 #5。  
調度：[`docs/architecture/orchestration.md`](../../../docs/architecture/orchestration.md)——**program 開獨立 session**；本 skill 只負責判斷「問什麼」。

記憶庫：`ENGRAM_LITE_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-lite-data`）。

## 何時跑

- **只**由 `POST /distill` 的 program 編排：在 `engram-lite-distill` **成功且開始前有可沉澱 work** 之後，**另開一次** Pi session 執行。
- Distill 早退（開始前 pool＋clarify pending 皆空）→ program **整段跳過**本 skill。
- Server／ingest／`POST /events`／Ask **永不**呼叫本 skill。
- 若第一次 generate 後 asking ＜ 3，program 會再開一次 session（retry）；prompt 會強調必須湊滿。

## 步驟

Vault＝`{store}/memories/`。

1. 讀 `{store}/workspace.yaml`（時區、語言）。
2. 讀本批剛沉澱的 day／相關 nodes（及事件摘要）；不要無節制掃全庫。
3. 列出現有 `clarify/asking/`（及 pending）題目，避免重複。
4. 在 `memories/clarify/asking/` **新建 MIN 3、MAX 5** 檔（一事一問）。優先：缺的關鍵事實、關係、時間／數量、可執行後續。語言跟 `memory_language`。
5. **0 題不合格。** 若覺得事實已足，改問可答延伸，仍須至少 3 題；禁止同義灌水。

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
- 不要少於 3 題（有沉澱的場次）

## 回覆

列出新建的 asking id（3–5 個）與各題一行摘要。短。
