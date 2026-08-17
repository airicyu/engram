# 0.37.0 reasoning

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與反例。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何本版不做記憶鏈

0.36 出貨後，鏈仍是可用的列表閱讀。橫向 strip 是獨立的版面賭注（拖曳、方向、一格一則），與「看出節點網絡」不是同一題。綁在同一號會讓驗收與實作互相拖。橫向鏈留 [backlog](../../backlog/memory-chain-strip.md)。

失敗模式：把「記憶頁看起來比較新」做成一次改兩個正交 UI，review 分不清迴歸來自鏈還是圖。

## 邊為何不算 chain 正文

0.31 明確 **不回填** 歷史 chain 的 node wikilink。若把舊日摘要裡的 P1 算進邊，疏密會隨「哪天開始寫連結」抖動，不像 standing understanding 互指。本版邊＝**node 主檔互指**。

## 為何要獨立 GET 而不是前端掃 md

節點多時 Memory 會重複下載全文；`refs`／`level` 需要 phases 可測的契約。否決「只打 `GET /memories/nodes` 再另抓每個 `{id}` 在瀏覽器數連結」當唯一來源（實作仍可用 `{id}` 做 detail）。

## 否決

| 方案 | 為何不選 |
|------|----------|
| 本版順便做橫向鏈 | 正交；膨脹 Track |
| `graph/links.yaml` 手維護 | 與已刪的 STM 衍生檔同一類假真相 |
| 邊用「同一天摘要共現」 | 本版只要 reference 強度 |
| Filter 隱藏非命中 | 圖上隱藏會讓人以為沒有連結；改 dim |
| 抬 boot／新 hop | 無新目錄、無刪檔 |
