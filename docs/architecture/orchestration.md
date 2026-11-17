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
       Session A（新 Pi session）：engram-distill only
         · prompt 帶入當地今天（workspace timezone）
         · 吸收 clarify/pending · 寫 chain／nodes · archive pool
         · 禁止寫 clarify/asking
         · 模型停筆後，程式核對本輪產物：開跑時的 pool 列已入 archived 且離開 pending；開跑時的 clarify/pending 檔已在 history/；本輪新建或改寫的日檔若落在已結束 ISO 週（今天晚於該週日），週記檔必須存在且新於那些日檔；若日檔落在已結束月份（今天的 YYYY-MM 晚於該月），或本輪重寫的已結束週與該月重疊，月記檔必須存在且新於那些日檔與週記；若本輪碰到已結束的年份（今天的年份晚於該年），年記檔必須存在且新於該年的日檔、週記與月記
         · 有缺：同一 session 再 prompt 一次，列出缺的檔，從中間繼續
         · 續跑後仍缺 → job failed，不進入 Session B
       Session B（新 Pi session）：engram-clarify-generate only
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
| 題目怎麼問、問什麼 | `.agents/skills/engram-clarify-generate` |
| 日記／node 怎麼寫 | `.agents/skills/engram-distill` |
| 是否兩 session、配額、早退、Session A 續跑／fail、retry／fail | `server/worker/pi.ts`、`server/worker/distill-gate.ts`＋本檔 |
| 機械 HTTP 形狀 | `docs/api.md`＋server 路由 |
