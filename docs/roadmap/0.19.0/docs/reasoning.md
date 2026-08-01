# 0.19.0 Reasoning

← [INDEX](../INDEX.md)

> **做什麼以 INDEX／docs 為準。** 本檔只留動機、反例與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何做活躍分

L2 nodes 目前平等，但真實認知有「最近常碰」的差異。先做 **可觀察的帳面分＋相對 display**，讓後續 Seek 偏置、network 大小等有準則可依；本版刻意 **只展示、不依分檢索**，避免範圍膨脹。

## 為何模型 A（非時間衰減）

曾考慮：隨時間衰減、或每場 dream 全體除以時間 factor。  
失敗模式：node 一多，每場改全體 score 檔＝高 I/O，與「一次夢只動少數 node」相反。

模型 A：**只對本場提及的既有 node 加分**；變冷主要靠觸頂後的 **global downscale**。語意變成「按有結算的 dream 次數／強度」增減，不是牆鐘衰減——可接受，且公式簡單。

否決：increment 再塞「天數加權加成」（idle 越久加越多）——與活躍直覺相反。

## 為何 downscale 獨立＋`exclude_node_ids`

Downscale 必須可被 dream **呼叫**，但契約上 **不認識** dream（以便日後單獨維護／API）。  
新建必須結束於 `S0`：若先寫 `S0` 再全體縮，會被連坐。用可選 **`exclude_node_ids`** 跳過新建，避免把「先縮舊再進場」寫死進 downscale 內部分支（那種才是真耦合）。

否決：downscale 吃 `dream_run_id` 自己查新建名單——flow 耦合 draft／dream 存儲。

否決：新建本場再 `+boost`——違反「新建＝default S」的 expectation。

## 為何 AI 只判 category

分數與觸頂是 **機械不變式**；LLM 填數字會漂、難測、難人審。  
Category 難 100% 準 → **report 列出＋2a 結構化改**，不靠整輪 retry。

## 為何開機檢查結構代（非 product 字串）

未 migrate 的庫開新 binary 可能「能啟動、讀寫卻錯形」。0.19 起缺 score 檔／舊形狀風險變大，故 **結構代不足則拒啟**並指向 migration skill。

必須比 **major.minor 最低代**，不能 `=== product_version`：否則 0.18 同形 stamp、或未來同代產品 bump 會誤擋。缺鍵視為未知舊庫，一併拒啟（可 `ENGRAM_ALLOW_STALE_STORE=1` 逃生）。

## 為何本版只做 2a、不做 2b

自由句改 draft 能修 category 也能修 chain，但易改爛 ledger／future-sight 格式。  
Category 錯判是高頻、結構化可解 → **2a script／API**。  
通用 draft edit（2b）價值大、風險大 → **拆 backlog**，不擋活躍分出貨。

## 為何非法 category 擋 pending

分數結算依賴枚舉；若允許帶髒 category 進人審，approve 時才爆或默默 skip，人審與結算會不一致。  
Extract 收尾失敗 → 可 retry；比「進 pending 再發現」乾淨。幽靈 **id** 則偏筆誤，skip＋警告以免整場作廢。

## 為何 empty_patches 不跑分數

現有 approve：無檔案變更時只清 short-term。活躍分表示「本場 L2／node 有沉澱涉及」；無 deploy 卻加分會讓分與磁碟記憶脫節。  
Artifact 非空但 empty_patches 屬異常組合，本版仍不結算（簡單、可測）。

## 為何分數在 commitDraft 之後寫 live

Score 檔是 live 狀態，draft approve 後會刪。寫入 live 並併入同次 `stageAndCommitPaths`，與 memories 部署同一 dream commit；掛點明確在 `approveDream`，不把公式耦合進 `commitDraft` 內部。

## 為何三檔叫 mention／update／focus

對齊「帶過／寫進理解／本輪主體」；比 `GRADE_0` 可進 prompt 與人審。  
兩檔太粗；四檔以上 AI 不穩。

常數（S0=100、S_max=2×S_target、boost 10／35／80）取整十便於手算；約數十場 focus 才觸頂，個人使用節奏下 downscale 稀但真會發生。

## 為何 display 用 max 正規化

帳面可累到很大；UI 要的是 **相對誰比較活躍**。`ceil(score/max*100)` 在正分下至少為 1，無需額外地板。  
空庫／無 max 不除零。

## 與「熱」字

未來視已用 hot／later。Node 側文件與 UI 用 **活躍分／score／display_score**，避免使用者以為是同一套分區。
