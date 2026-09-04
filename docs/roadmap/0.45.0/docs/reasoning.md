# 0.45 reasoning

← [INDEX](../INDEX.md)。做什麼以 INDEX／HOW 為準。本檔只留動機與否決。若要改已定案，須先回答：原本要防的失敗模式是否仍成立。

---

## 為何拿掉 planner 而不是換快模型

`enforceRollupPlan` 已是真相：LLM plan 與磁碟規則衝突時以磁碟為準。再開 Claude Code 只為 JSON 計畫，牆鐘長、對週月年**正文**無貢獻。Writer 才是 0.38 散文品質所在，故不動 write prompt。餵 enforce 的 stub **不要**帶 `reason: "mechanical"`，否則空 targets 會蓋掉 `no closed periods to roll up`。

否決：留 planner 但 Haiku——仍冷啟動；本版明確不做模型分流。

---

## 為何 generate 綁「本場寫了 week」而不是「有新 node」

Generate 的候選人是 **既有** node（分數排序，避開本場 update／focus）。實務上 extract 也不主動 create。若「沒新 node 就不問」，提問郵箱會乾掉，與 0.30「入夢末產問」相反。

綁 closed week 被寫出：日常在當週內多次入夢時，當週本就不進 week candidate，問題自然降到約「週沉澱一次」。同一場 catch-up 多週只 generate **一次**，避免連開三場又頂滿 10。

滿 10 仍跳過：再產也會被 cap 擠掉，白跑 agent。

否決：每 N 場計數器（要持久化、與週界不同步）。否決：month／year 寫出也觸發（使用者定的是 week block）。

---

## 為何名片是 Identity 摘錄不是「本場 mention 才內嵌全文」

Mention 全文仍可能很大，且 Relation 常要認「沒在這批事件裡點名、但圖譜上存在」的 id。清單 + 短 Identity + 路徑讓模型知道有誰；要改才 Read。另開 LLM 產 summary 會抵消加速。

風險：模型不 Read 就改寫。用 prompt 硬規則補（含「空 excerpt ≠ 不存在」），而不是把全文塞回 JSON。Mock 必須自己讀主檔，否則 phases 會把名片當 standing。

**不要**把 GET `/memories/nodes` 的 `understanding`（工作台讀全文）改成 excerpt——那是另一契約。

---

## 為何不做日塊平行

5–6 天一次夢：現況是 **一場** day extract 寫多個 day 檔。拆成每天一 agent 會讓跨日 node、未來視、involvements、報告各寫各的。第五點原本只討論同層 **week** writer 並行；跨日 extract 不是同一題，品質風險更大。本版非目標。

---

## 為何只對 generate 拿掉 store `--add-dir`

`--add-dir` 是開門讓 CLI 能碰到目錄，不是把檔案塞進 prompt。Day extract 在名片化之後 **更需要** 開 store 門去做 Read。Generate 的輸入已在 JSON，掛整庫只增加掃描。Claude invoker 今日無條件 `--add-dir storeDir`，故要旗標；Cursor generate 本來多半只掛 writable temp。
