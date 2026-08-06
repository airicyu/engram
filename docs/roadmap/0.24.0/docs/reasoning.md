# 0.24.0 — Reasoning（WHY）

← [INDEX](../INDEX.md) · HOW：[empty-dream-rollup.md](./empty-dream-rollup.md)

> 做什麼以 INDEX／HOW 為準。本檔只留動機與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 問題

使用者在 T0 入夢並清空 short-term 後，若連續數日沒有新 activities，到了「上週／上月已結束」的日曆日，**無法再觸發** higher-chain 關帳補建——因為 `POST /dreams/run` 在空 pool 時固定 `nothing_to_dream`，而 rollup cascade 掛在 dream 管線後段。

權宜做法（隨便 capture 一句再入夢）能觸發磁碟掃描 catch-up，但強迫製造無意義 L0，污染活動流。

---

## 為何選「同一入夢動作」而不是新端點／新按鈕

討論過的方案：

| 方案 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| **A. 空 pool 時同一 `POST /dreams/run`＝rollup-only** | 無新產品動作；UI／技能／習慣不變 | 須文件說清「空入夢」語意 | **採用** |
| B. `POST /dreams/rollup` 或第二顆「關帳」按鈕 | 語意分離 | 多一個動作；Consolidate 變複雜 | **否決**（本版） |
| C. 僅排程 cron 自動 rollup | 免手動 | server 不常駐則不跑；仍缺手動開關帳 | 可作後續；**不取代** A |

使用者明確偏好 A，且不要 introduce 多一個動作。

---

## 為何跳過 day extract、而不是空轉 agent

空 scope 沒有 events／L1 可沉澱。若仍叫 extract agent：

- 浪費時間與費用
- 易幻觉寫出無依據的 day／node 變更
- 與「approve 前草稿來自本輪輸入」的心智模型衝突

故 rollup-only **禁止** day extract spawn；只跑 cascade（planner／writer 仍要）。

---

## 為何 409 仍用 `nothing_to_dream`

可引進 `nothing_to_rollup`，但 UI／self-test／外部腳本已认 `nothing_to_dream`。本版優先少破壞：空且無事可做時 **碼不變**，message 寫清原因即可。若日後客戶端要細分再 bump。

---

## 為何要 preflight、不要先 202 再失敗

若空 pool 一律 202 再跑 cascade 發現無 targets，使用者會看到短暫 job／可能的 agent 呼叫再失敗，體驗差且費 token。機械 `hasRollupCatchupWork` 成本低，應在 acquire lock／start job 前擋掉。

---

## 為何 auto dream 也要對齊

若手動可 rollup-only、排程卻因空 pool skip，長期常駐使用者會以為「夜間會關帳」卻永遠不跑。同一 `runDream` 規則可免兩套語意。

---

## 失敗模式（實作勿踩）

| 模式 | 防法 |
|------|------|
| 空夢寫入開著的當週／當月 | 既有 `is_current_period` 硬剔除；本版不放寬 |
| 空夢仍跑 extract | 管線分支顯式 skip；測試断言無 extract spawn |
| 新增第二按鈕「以免搞混」 | 違反已定案；改文案而非加動作 |
| 無 catch-up 仍 202 | preflight；409 |
| approve 因缺 involvements 失敗 | rollup-only 寫空 artifact |
