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
