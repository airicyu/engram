# 0.3.0 WHY

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與否決。若改已定案，須先回答失敗模式是否仍成立。

## 失敗模式：做成 mini-Engram server

Lite 若把 distill／clarify 生成搬進 `server/`，之後每個寫作規則都會變成 TypeScript。本版所有「追 Engram 的面」都必須能在「skill 寫檔 + 薄 GET／機械 POST」下成立。搜尋與圖是掃描磁碟，不是智能。

## 否決：future-sight 與打分（本版）

Ask 加讀未來視、圖依分數篩，會再增兩套契約（過期桶、分數公式）。搜尋＋圖先讓人找得到現有 chain／nodes。未來視／打分可進後續版。

## 否決：上傳 tmp

Engram tmp 是為了「組稿中／入夢 lock」。Lite 無 pending_review。一步寫正式目錄，放棄組稿＝磁碟可能留孤兒檔，可接受；housekeep 不當本版主路徑。

## 否決：Dream appendix

Server 組 `## Attachment relationships` 是為了沒有結構化 `attachments[]` 的純 markdown 給入夢讀。Lite 事件 JSON 可帶 `attachments[]`，distill 讀欄位即可，不必再拼一段 appendix。

## 否決：Vite／React 工作台

套用 Engram **資訊架構**（四欄場景）即可。整份搬 `web/src` 會把 dream lock、report、graph 實作細節一併拖進來，違反薄 UI。

## 否決：內建 cron

單一 job worker 已在。再做 daemon 要處理時區與重疊 distill。crontab 打 POST 與按鈕等價。

## 釐清為何仍直接寫 live

Engram 的 asking 要等 approve 才進 L2。Lite 的產品句是 distill 直接改 vault。人答進 `clarify/pending/`，**下一場 distill** 吸收——中間沒有 report。這是刻意的，不是漏做 approve。

## 為何生題與沉澱拆開，且強制 3–5

可選「缺事實才問／無把握就不要問」在 flash 模型上常變成 **0 題**（實測：沉澱成功但 asking 空）。Engram 以獨立 generate＋MIN／MAX 配額保證郵箱有題。Lite 對齊該產品預期，但生題仍走 **skill 寫檔**，不把出題搬進 server。

## 為何 distill 與 clarify-generate 的順序寫死在 program

見 [`docs/architecture/orchestration.md`](../../../architecture/orchestration.md)。

摘要：配額與「有沉澱才生題」是產品不變量，交給單一 soft prompt「記得跑第二步」會漏（實測過可選出題 → 0 題）。Program 只鎖順序與早退；**問什麼**仍在 skill。這符合「調度寫死、判斷還給 skill」，且調度有獨立 WHY，不是只有 `pi.ts` 字串。

## 為何生題必須是獨立 session（不是單 prompt 兩 phase）

可選「缺事實才問」或「同一 session 寫 Phase 1 then Phase 2」在 flash 模型上常變成 **distill 後停、asking＝0**。Engram 以獨立 `runClarifyGenerate`＋MIN／MAX 配額保證郵箱有題。Lite 對齊：program **兩次** `createAgentSession`；skill 只判斷問題內容；＜3 再試一次，仍不足則 fail——禁止 silent complete with 0。
