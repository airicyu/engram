# 0.17.0 — Reasoning（WHY）

← [INDEX](../INDEX.md)

> **做什麼以 INDEX／docs 為準。** 本檔只留動機、反例、否決項。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何 mindzone 與未來視收成一件事

0.4 把「短期未來 mindzone」拆到 backlog，是怕 moving window 與錨點寫入／過期／Recall 纏在一起導致範圍失控。

產品上使用者要的不是第二個庫，而是：**同一批近程錨點裡，近的形成惦記熱區**。  
若另做 mindzone store，會重覆過期、同步、人審與兩套 id。

**選定：** 只有未來視；`hot`／`later` 是分區，不是新記憶層。舊 backlog「mindzone」語意＝hot 區工作集。

## 為何是兩整檔，不是 hot/／later/ 下多檔

一錨一檔再拆目錄 → 「搬區」＝rename，與 0.16 整檔敘事風格不一致，也讓人不知 item 還要怎麼拆。  
兩檔：`zone`＝檔本身；入夢／維護＝整檔覆寫＋排序；draft path 最多兩條，approve／git 更單純。

**否決：** `hot.md`＋`future.md`（與層名 future-sight 撞車）。**否決：** `long-term.md`（與 L2 長期記憶撞詞）。**選定：** `hot.md`＋`later.md`。

## 為何機械維護與 AI 必須拆開，且維護在入夢前 commit

| 若全部交給 AI | 失敗模式 |
|---------------|----------|
| 漏刪過期、漏搬區、排錯序 | 熱區不可靠；人審難查日曆 bug |
| 過期也走人審 | 使用者擋 approve 時，過期錨點仍假活 |

| 若 GET 也重桶 | 失敗模式 |
|---------------|----------|
| 每次瀏覽改 zone＋git dirty／commit | 未入夢也改「工作集」；歷史吵 |

**選定：** 日曆運算＝純 script；文意加減改＝AI＋approve。  
過期清除＝入夢前（及 GET）可直接 commit；與 dream 內容變更兩步兩種語意（expired vs cancelled）。

## 為何判斷日用入夢日，不用 activities 寫入日

同一句「下週五」若在 capture 日與入夢日之間跨了午夜或延遲入夢，用寫入日分叉會讓准入／分桶難解釋。  
Extract 本就在入夢時把相對日收成絕對日——**同一時刻**套 window／hot 最一致。

## 為何超出 window 硬不進未來視

延續 0.4：未來視是近程可過期錨點，不是人生遠景骨幹。遠的走 node／當日 chain。  
若先寫入再標「很遠」，later 會變成雜物抽屜，熱區對照失焦。

## 為何本版不做 Seek 注入

先讓兩檔＋維護＋遷移穩定；注入會牽動 ask／search packet 與 prompt 噪音。  
日後若做，預設應只注 **hot**（見 backlog），且可能不再需要「裸注全部 active」。

## 為何 config 不是 env override

現碼 timezone／memory_language 是 **workspace 若有鍵則用之，否則才 env，否則預設**。  
若未來視改成 env 蓋 workspace，同一檔會出現兩套優先序，操作與文件都會錯。  
「可 env 設定」＝沒寫進 workspace 時的後備，不是 override。

## 為何 config 不強制 hot &lt; window

使用者明確接受 later 常空。強制校驗會在調參時拒啟，收益低。  
非法型別仍拒啟（防 typo 變成 NaN 天）。

## 為何 approve 前對 draft 必跑 full maintain

AI 仍可能分錯區或未排序。Deploy 前 script 校正，避免錯誤 live 進 git。  
過期項在 draft 上不靜默當 live 過期寫 L0（尚未批准）→ **409**，逼人審／retry。  
Deploy 後再 maintain 無額外保證，故不強制。
