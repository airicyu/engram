# 0.26.0 — Reasoning

做什麼以 [INDEX](../INDEX.md) 為準；本檔只留 motivation／反例。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何選 `understanding`

- 產品語意是 **standing understanding**（0.25）；短鍵 `understanding` 一眼對上，不必再解釋「current」。
- 否決 `standing`：較短但較像形容詞／狀態旗標，不如名詞欄位清楚。
- 否決 `what`：對齊檔名，但 API 讀起來像檔案碎片，且與歷史「what facet」混淆。

## 為何一次改名、不做雙欄

- Engram 原型無外部整合 SLA；主客戶端是同 repo 的 web＋skill／文件，可同步改。
- 雙欄一版會延長「兩個鍵同值」的文件負擔，且易讓人繼續寫舊鍵。
- 失敗模式要防的是：**文件寫 standing understanding，JSON 仍叫 `what_current`** → 新人以為只回 Current 段。一次改名直接消滅該裂縫。

## 為何不改 `what.md` 路徑

- 本版只解 **wire 命名**；檔名／目錄另案成本高（draft、migrate、prompt 路徑）。
- 路徑 `understand/what.md` 已與「understanding」語意相容，無需連動。
