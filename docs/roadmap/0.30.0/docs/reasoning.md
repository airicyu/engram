# 0.30.0 — Reasoning（為何這樣定）

← [INDEX](../INDEX.md)

做什麼以 **INDEX** 為準；本檔只留動機、反例、否決方案。若要改已定案，須先能回答：原本要防的失敗模式是否仍成立。

---

## 為何要有「釐清」而不是塞進既有場景

| 方案 | 為何不選／限制 |
|------|----------------|
| Activities 旁常駐提問 | 打擾 capture；與「記下發生的事」混音 |
| Seek 反向提問 | Seek＝人問系統；同框雙向問會毀心智模型 |
| Consolidate 主操作加補問 | Consolidate UI 已滿（Revise／involvements）；補問是日常互動，不是審稿動作 |
| 獨立 admin 式 inbox | 違反「工作台不是 dashboard」 |

**釐清**作為第五場景：與 Seek **對偶**（系統問人），與 Activities **分流**（不寫 L0）。

---

## 為何不走 `POST /activities` 閉環

早期 backlog 曾想：回答一律當 activity（可加 `source`）。否決理由：

1. 會進 short-term → extract 可能寫 **chain／ledger**，與「補認知 ≠ 記事件」衝突。
2. L0 唯附加事件 log 被「問答碎片」污染。
3. 難以表達「系統發起的補問」與「人自發事件」的差別。

改為 **`memories/clarify/` 三 queue**：平行緩衝；入夢蒸餾；**仍經 approve** 才進 live nodes。

---

## 為何 distill 進 draft、approve 才生效（不是 silent 寫 L2）

Engram 契約：L2 變更經 dream staging＋人審。若 pending 答覆直接改 live nodes：

- 與「Approve 才 deploy」不一致
- Consolidate 看不到「理解從哪來的補問」
- discard／retry 語意變複雜

因此：`clarify_distill` **只寫本輪 draft nodes**；`pending/` 檔案留到 **approve 才 move → history**；**discard 不動** asking／pending。

---

## 為何 distill 白名單＝僅 node 主檔

釐清承諾的是 **standing understanding**，不是時間軸。

若允許改 chain／future-sight：

- 「不是 activity、不進 ledger」在實作上被掏空
- 順帶補充易被誤用成「改寫歷史事件」的後門

**修錯 activity** 仍應再寫一則 Activities 更正（走完整 extract 白名單），不經釐清。

---

## 為何 generate 在 distill 之後

順序：`clarify_distill` → `clarify_generate`。

- 先把人已補的認知寫進本輪 draft，再基於「更新後的夢／理解狀態」發新問，減少問已答過的缺口。
- 兩 job 獨立：失敗相位可觀測；prompt 可分檔。

---

## 為何 asking 上限 10＋prune 真刪

- 上限維持「此刻最值得問」，不是永久問卷庫。
- Prune 不留審計／黑名單：問題是啟發式的；刪了以後仍可再問；少一層複雜度。
- Dismiss 與 prune 同為真刪，心智一致。

---

## 為何 rollup-only 仍跑兩 job

否則：pending 永遠等不到 distill；asking 在「只有 rollup 的日子」也不更新。空 pool 入夢仍是合法夢，釐清是末段附加責任，不綁 short-term 是否有事件。

---

## 為何 distill 一次讀整包 pending

逐檔串行易對同一 node 主檔互相覆寫／遺漏合併。一次讀集合，由 agent 統一改 draft nodes。

---

## 否決的命名

| 名 | 原因 |
|----|------|
| FAQ | 像說明文件，不像個人記憶 |
| Wonder／「幾則好奇」 | 中文不可數、翻譯腔；英文可作氣氛但正式 domain 用 clarify |
| Prompt／Gap | 太工程或與舊 activation `gap` 混淆 |

採用：**釐清**（場景）／**補問**（系統問題）／**順帶補充**（freestyle）。
