# 0.20.0 Reasoning

← [INDEX](../INDEX.md)

> **做什麼以 INDEX／docs 為準。** 本檔只留動機、反例與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何 0.20 做重構而不是新功能

0.19 完成活躍分後，產品循環已可試用；code review 暴露的是 **不變量未被強制**（agent 可寫 live、lock 可互砍、capture 競態），不是缺另一個記憶功能。繼續疊功能會提高半套狀態與「人審被繞過」的機率。先加固再排 2b／Seek-by-score。

## 為何拆成多 Phase 且每 Phase 必測

這類改動若「一次改完再測」，失敗時難以定位是 sandbox、lock 還是拆檔引起。  
Phase 邊界對齊風險層：先 **正確性 P0**，再 **結構 P1**，再 **Web**，最後出貨總閘。  
閘門寫進 `phase-gates.md` 是為了讓 **另一個 agent** 也無法「自認做完就進下一階段」。

## 為何不 bump `store_version`／不做 migrate

本版目標是 process 內行為與碼結構，**磁碟上的 memories 佈局與 0.19 相同**。亂 bump 會逼所有使用者跑空 migrate、混淆「結構世代」語意（見 0.16／0.19 store-version／boot-gate）。  
Product `0.20.0` 只標記軟體版；boot 仍 ≥0.19。

## 為何 sandbox 允許 Read live、禁止 Write live

Dream／Ask 需要讀既有 L2／chain／未來視才能寫出有根據的 draft／答案。  
失敗模式是 **寫入** 繞過 approve，不是讀取。因此政策是讀寬、寫窄。  
否決：把整個 store 唯讀複製進 sandbox 再讓模型只看副本——正確但改動與 token／同步成本大，本版以 runner 能力限制優先。

## 為何不把「取消 Bash」寫死成唯一方案

Claude 現況給 Bash 極易逃逸寫入。理想是去掉或關進 workdir；但不同 CLI 能力不同，INDEX 允許「workdir＋可寫根」等價策略。  
否決：只改 prompt 說「不要寫 live」——模型與工具不保證遵守。

## 為何 lock 用 token 而不是只信 holder 字串

`holder` 今日是 `dream-run`／`dream-approve` 等粗名，兩次 run 可能同名。Stale 後新 run 也寫 `dream-run`，舊 finally 無法區分。  
**每次 acquire 唯一 token** 才能 compare-and-delete。  
否決：加長 stale 到 24h 當「修復」——只減少機率，不消除 finally 誤刪。

## 為何 lock 本版不做 heartbeat

Heartbeat／PID 能修「程序已死但 lock 未過期」與「真的跑超過 30 分鐘被誤判 stale」。有價值，但要 job 寫入心跳、cancel 語意更複雜。P0 先修 **誤刪他人鎖**；死鎖／長任務屬下一層（可 backlog）。

## 為何 capture 只要求單 process 原子

Engram 原型是單機單 server。先用 in-process mutex＋正確 ID 消除常見競態。  
否決：本版上 SQLite／外掛 queue——範圍膨脹。  
否決：保留 `wc -l` 但「加 retry」——仍有 TOCTOU。

## 為何不做 approve journal

Deploy＋score＋git 的跨 crash recovery 是獨立大題（狀態機、重入、與 0.16 git 回滾語意交織）。與「agent 隔離／lock／capture」不同維度。塞進 0.20 會拖垮 Phase 閘門。維持 0.16 盡力回滾＋可觀測 log；journal → 後版。

## 為何刪 materialize 而不是「留著備用」

雙 write model 會讓下一個 agent 誤接舊路或改錯檔。0.16 已 hard-cut file pipeline；死碼的正確命運是刪，不是註解「或許有用」。

## 為何 Web 不強制 shared Zod package

契約漂移真實存在，但 monorepo package 是工程平台題。本版用 endpoint client＋TS 型別就能消大半 Scene 複製；Ask／Memory 生命週期 bug 也不靠 Zod 才能修。完整共享 schema → 後版。

## 為何 Phase 7 抽 generic agent flow（而不是只搬家）

Ask／Dream／Rollup 的真實共用段是：**template→prompt→spawn→寫約定檔→讀回**；差異在業務 gather 與交付 path。若只把 `ask-*.ts` 挪進子目錄，CLI argv 仍複製三份，改 write-policy／Cursor 旗標仍要改多處。  
先 **`AgentInvoker`**，再按 `flow`／`providers`／`shared`／業務分夾，結構才對齊心智模型。

否決：把 cascade／approve／score 塞進 generic——那是產品編排，會讓「簡單 flow」變成第二個 god。  
否決：只為 Dream 發明「單一 temp answer 檔」——Dream 交付是整棵 draft＋report，與 Ask 單檔不同；generic 用 `requireFiles` 表達機械檢查即可。

## 為何 Phase 7 仍算 0.20.0、不開 0.21

同屬「正確性後的可維護性」、無 store／API 產品面變更；開新版號會讓「0.20 已 shipped」與「agent 層仍平鋪複製」並行，文件更亂。Phase 0–6 成果保留；Phase 7 完成後修訂同節 changelog，狀態再 `shipped`。

## 為何 Phase 8 重組 `src/dream/`（而不是停在 Phase 4 拆檔）

Phase 4 解決的是 **單檔過肥**；拆完後仍平鋪，瀏覽成本與 Phase 7 前的 `agent/` 相同。分組鍵改為 **產品生命週期**（execute→review，旁路 report／score／rollup），與「入夢怎麼走」一致。  
保留 `run.ts` barrel 是為了 API／CLI import 穩定，避免純搬家 PR 爆改呼叫端。

否決：把 `store/dreams` 併進 `src/dream`——持久化與編排混層。  
否決：把 `agent/dream` 併進 `src/dream`——CLI 與業務再次黏在一起（Phase 7 剛拆開）。

## 否決清單（摘要）

| 提案 | 否決原因 |
|------|----------|
| 只改文件宣稱 agent 勿寫 live | 無強制力 |
| 無條件 `releaseLock`＋加長 stale | 不修 owner 誤刪 |
| 0.20 順便做 2b／Seek-by-score | 範圍與風險錯配 |
| bump store_version＝0.20.0 | 無結構差；誤傷使用者 |
| 一次重寫整個 server／web | 無法逐 Phase 驗收 |
| approve 完整 journal 同版 | 过大；擋 P0 出貨 |
| 只搬家、不抽 Invoker | 重複與旗標漂移仍在 |
| Generic 吞掉 dream／approve 編排 | 邊界消失、難測 |
| Phase 8 合併 agent/dream 與 src/dream | 推翻 Phase 7 分層 |
