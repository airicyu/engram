# 控制面調度（orchestration）

← [`AGENTS.md`](../../AGENTS.md) 警世原則 · 0.3.0 細節：[`docs/roadmap/0.3.0/docs/how.md`](../roadmap/0.3.0/docs/how.md)、[`reasoning.md`](../roadmap/0.3.0/docs/reasoning.md)

## 一句話

**調度寫死在 program，把判斷還給 skill**——而且調度本身必須有 WHY 文件，不能只有程式。  
`POST /distill`：**兩次獨立 Pi session**（不是同一 prompt 寫「Phase 1 then Phase 2」）；skill 只負責判斷「怎麼寫／問什麼」。

## 為什麼控制面要寫死在 program

| 寫在 program 的 | 為什麼不能丟給 skill |
|-----------------|----------------------|
| HTTP → job／202、單 worker、鎖 | 要可重試、可觀測、避免雙開 Pi 互踩 vault |
| distill **之後**是否跑 clarify-generate | 產品要求「有沉澱就強制 3–5 題」；交給模型「記得跑第二階段」會漏（實測：單 session 兩 phase prompt 常在 distill 後停） |
| **兩次** `createAgentSession` | 對齊 Engram `runClarifyGenerate` 獨立流程；乾淨 context，避免 distill 寫完就停 |
| 空庫早退 → **跳過** generate | 機械：開始前 work＝0 則不生題 |
| asking ＜ 3 → **再跑一次** generate；仍不足 → job **failed** | 配額是產品硬約束，不可 silent complete with 0 |
| 讀／搬／校驗 path、MIME、對稱 attachments | 確定性 I／O，不需要語意 |

Skill 仍負責：**怎麼寫** chain／nodes、**問什麼**釐清題、文體與取捨。

## 現行管線：`POST /distill`

```
POST /distill
  → 若已有 queued/running distill → 409 distill_already_active
  → 202 + job（queued）
  → worker：
       計算 work = pending.jsonl 非空行數 + clarify/pending/*.md（不含 .gitkeep）
       若 work == 0 → early-exit，跳過 generate，job completed
       Session A（新 Pi session）：engram-lite-distill only
         · 吸收 clarify/pending · 寫 chain／nodes · archive pool
         · 禁止寫 clarify/asking
       Session B（新 Pi session）：engram-lite-clarify-generate only
         · clarify/asking/ 強制 MIN 3、MAX 5
       若 asking < 3 → Session B′ retry generate（強調至少 3）
       若仍 < 3 → job failed（明確錯誤，不 silent complete）
  → 中途 progress：console.log + saveJob（UI／GET /jobs/:id 可見 distill…／clarify-generate…／retry generate…）
```

實作錨點：`server/pi.ts`（`runDistillOrchestrated`／兩次 session）、`server/index.ts`（mutex、progress）。  
契約：`docs/roadmap/0.3.0/INDEX.md` 已定案 #5。  
對照 Engram：`engram/server/src/dream/clarify/generate.ts`（`runClarifyGenerate`）、`CLARIFY_GENERATE_MIN=3`／`MAX=5`。

## 禁區

- Server **不**生成釐清題正文、**不**決定日記文體、**不**決定要不要開某個 node。
- 不要把「分類表／規則引擎」搬進 TypeScript 代替 skill。
- 不要只用 soft prompt「Phase 1 then Phase 2」指望模型自跑 generate（已證實不可靠）。
- 不要只改 soft 文案卻拿掉 MIN／MAX 配額，又期望郵箱「一定有題」。

## 何時改哪裡

| 想改的行為 | 改 |
|------------|-----|
| 題目怎麼問、問什麼 | `.agents/skills/engram-lite-clarify-generate` |
| 日記／node 怎麼寫 | `.agents/skills/engram-lite-distill` |
| 是否兩 session、配額、早退、retry／fail | `server/pi.ts`＋本檔＋該版 INDEX／how／reasoning |
| 機械 HTTP 形狀 | `docs/api.md`＋server 路由 |
