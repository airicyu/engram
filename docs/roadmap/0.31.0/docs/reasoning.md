# 0.31 — Reasoning

← [INDEX](../INDEX.md)

做什麼以 INDEX／docs 為準。本檔只留 **為何** 與 **否決過的做法**。若要改已定案，須先能回答：原本要防的失敗模式是否仍成立。

---

## 為何 hash 而不是 path router

- Workbench 由 Vite dev／Bun 靜態服務；hash **不依賴**「任意 path 回退到 `index.html`」。
- 產品要的是可分享深鏈，不是 SEO；`#/memory/nodes/eric` 足夠。
- 場景本來就是 client state；與 hash 雙向同步改動面小於引入完整 router 生態。

否決：本版就上 `BrowserRouter`＋server rewrite——收益小、部署假設變多。

---

## 為何 preprocess 而不是換 MD 引擎

- 已有 `react-markdown`＋GFM；Obsidian wikilink **不是** CommonMark。
- 轉成 `[label](#/memory/nodes/id)` 後走標準 link，與 hash 路由同一套。
- 短連必須 **known-id 閘門**：否則任意 `[[foo]]` 都會變成假導航。

否決：把整份 Obsidian parser 搬進前端——過重；本版只認 P1＋gated 短連。

---

## 為何 chain 也要在「寫入時」加 wikilink

- 0.28 解決的是 **standing understanding** 可導航；時間軸（chain）仍是純文字提及時，Obsidian graph／UI 抽邊在「哪一天提到誰」上是盲的。
- 寫入當下 agent **已經知道** `existing_nodes`／本輪 create 名單——這是成本最低、誤連最少的時刻。

---

## 為何不做「node 新建後回填舊 chain」

失敗模式：

1. **指認不穩：** 舊文「跟小明吃飯」在後建 node `ming` 時，自動 NER／字串取代易誤連同名、暱稱、已無關的舊句。
2. **歷史篡改感：** chain 是時間軸證據；安靜改寫過去 summary 會讓 approve 過的敘事與 git 史複雜化。
3. **範圍爆炸：** 全庫掃描＋逐檔 dream 或規則引擎，等於另做 migrate／產品功能。

使用者已接受：**當時不存在就不 link**；之後若整檔被 dream／amend **再寫一次**，才依新集合補——這是順帶改寫，不是獨立 backfill。

否決：approve 新建 node 時觸發「掃描最近 N 天 chain 自動掛 link」——本版不做。

---

## 為何 ledger 不做自動 soft lint

- Ledger 是多 block 累加；啟發式「出現 id 字樣」誤報多、實作成本高。
- Summary 是整檔敘事、與 node 主檔 lint 較同形；本版 lint 預算放在 summary。

---

## 與 graph backlog 的分工

本版只讓 **md 內邊** 更完整（node↔node 在 Relation **與** chain 出現），並讓 UI 能點。  
互動 graph GUI 其後出貨為 [0.37.0](../0.37.0/INDEX.md)；圖可掃這些 `[[nodes/…]]` 當邊來源。
