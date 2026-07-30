# 0.18.0 — Reasoning（WHY）

← [INDEX](../INDEX.md)

> **做什麼以 INDEX／docs 為準。** 本檔只留動機、反例、否決項。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何本版做 Seek，而不是再改 store

0.16／0.17 已完成 draft＋git 與未來視雙區／機械維護。寫入與過期路徑已可 dogfood；缺的是 **Seek 讀不到未來視**（ask prompt 甚至總禁）。  
再拆存法收益低；讀側閉環才能驗證「惦記／停泊」是否真的幫到提問。

## 為何 window 預設改 365

90 日窗使「半年後檔期」進不了未來視（被推去 node／chain 或丟掉近程錨點語意）。產品希望一年內可錨定的事停在 later。  
**只改預設、不 migrate 既有鍵**：已顯式設 90 的使用者不被靜默拉長；新 store／缺鍵才吃 365。

## 為何 Search 兩區全掃、不要 later flag

Search 是 **script 關鍵字**，掃兩整檔成本極低；且「有沒有命中」不依賴模型判斷。  
若 Search 也做「預設只 hot」，使用者用同一句「正式版何時出」會在 Search 漏 later、在 Ask 又另一套規則，認知分裂。

**選定：** scope `future`＝hot＋later 一起掃；**不**做 search 的 include_later。

## 為何 Ask 不能也預設讀 later

Ask 用 AI 讀檔，token／延遲成本高；later 在 window=365 後可累積較多停泊項。  
預設只開放 **hot**（近窗工作集），與 0.17「hot＝惦記」對齊；需要一年窗內較遠錨點時再開 flag。

## 為何不能靠問句判斷該不該讀 later

反例：「XX 遊戲正式版記不記得是什麼時候出？」

| 實際落點 | 可能 |
|----------|------|
| 過去 chain／node | 已出過或當事實寫過 |
| hot | 近月要出 |
| later | 八個月後才出（窗 365 內） |

問句形態相同，**無法**可靠路由。因此「server／模型偵測遠期再注入 later」與「兩段式找不到再讀 later」都會在真實問答裡漏或錯。

## 為何否決兩段式 Ask

方案：先讀 memory／node／hot；若「找不到」再讀 later。

**失敗模式：** 過去或 hot **有提過一點**（舊檔期、模糊提及），模型在第一段就自以為找完並作答，**不進入第二段**——而 later 可能有更新／正確檔期。  
「找沒找到」對 LLM 是軟判斷，不適合當閘門。

**選定：** 使用者顯式 `include_later`；**不做**自動兩段。

## 為何否決「Ask 永遠只 hot、later 只能 browse」

window=365 後，中長期檔期主要住在 later。若 Ask 永不可讀 later，使用者只能去 Memory／raw 檔或改靠 Search 命中後自己拼——Seek 閉環不完整。  
Flag 把成本開關交給使用者，同時保留預設省 later。

## 為何 Search 用 scope token `future`，而不是永遠無視 scope

既有 UI 已有 scope 勾選（l1／nodes／chain）。加 `future` 可讓使用者關掉未來視關鍵字，而不引入「later 專用 flag」的第二套控制。  
省略 scope 時預設四者全開＝「簡單全讀取」的預設體驗。

## 否決項摘要

| 方案 | 為何否決 |
|------|----------|
| Ask 兩段式自動讀 later | 早停；舊／hot 弱命中擋掉 later |
| Ask 預設每次讀 later | 成本；與 hot 工作集預設衝突 |
| Search 的 include_later flag | 無必要；script 已便宜 |
| 依問句分類 zone | 問句不可辨 |
| 本版改分桶／檔格式／maintain | 非本版問題；增加風險 |
| 強制改寫既有 workspace 90→365 | 靜默改使用者明示設定 |
