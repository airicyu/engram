# 0.16.0 — Reasoning（WHY）

← [INDEX](../INDEX.md)

> **做什麼以 INDEX／docs 為準。** 本檔只留動機、反例、否決項。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 為何仍要 draft＋人審（否決「原地改 live」）

Backlog 舊構想曾傾向：直接改 live working tree，人審看 `git diff`，成功再 commit。

**否決原因：**

- Pending 期間仍允許 `POST /activities`（已定維持）。若 live L2 已 dirty，失敗時 `reset --hard` 會誤傷新 L0／short-term。
- Seek／ask 在人未 approve 前不應看到未批准長期記憶（0.3 起不變式精神）。
- Report／敘事審核需要穩定「即將部署的投影」；draft 目錄比「半套 live diff」好懂。

**選定：** draft 作業 → 人審 → deploy → git commit（Option A）。

## 為何要 git（而非只靠快速 rsync）

- 現行 `commitDraft` 的 bak 回滾 **跨行程崩潰不保證**。
- Approve 後需要可查的 **歷史**（blame／show），不只是當下 live。
- Deploy 本身可以很快；git 的價值是 **事務邊界＋歷史**，不是取代 draft。

## 為何廢 typed patch 驅動

- 多 type schema＋server 模擬編輯器成本高、難擴。
- Git＋檔案工作樹後，intent 就是「draft 裡改了哪些檔」；report 改由固定 narrative 承擔「給人看的意圖」。
- **不是**廢人審，只廢 JSON patch union 當管線中樞。

## 為何保留 ledger append-only（第二原語）

- Day 雙軌：ledger＝稽核鏈；summary＝可讀最新敘事。
- 若 ledger 也只靠 LLM file_update，容易默默改寫舊 block；人審難每次盯。
- Git 歷史 ≠ 打開當天 ledger 檔可見的多 block 時間線。

## 為何 summary／what 去掉 Current／History

- 使用者明確：**看現在就夠**；舊版不必嵌在檔內。
- 有 store git 後，檔內 History 與 commit 歷史重複且增加 prompt／讀取噪音。
- Week／month／year 已是整檔 snapshot；day／what 對齊更一致。
- Migrate：**丟棄**檔內 History 正文（接受不可從 md 還原舊 Current；git 在 migrate 前若無則本來也沒有）。

## 為何 `dreams/`／store `tmp/` 不進 git

- Dream 丢失可重跑；進 git 會讓每次 pending／job 態弄髒歷史。
- Store `tmp/` 為執行態（虛擬 clock）；ask job 已改到 **`ENGRAM_TEMP_DIR`**（預設 `/tmp`），同樣不進記憶快照。

## 為何 `memories/**` 全進（G1）而非只進 L2

- L0／short-term 也是使用者資料；設定與記憶同一 store 歷史較完整。
- **代償：** 回滾必須 **按 path**，禁止整庫 `reset --hard`——這是 G1 的失敗模式防護，不可拿掉。

## 為何無 git 拒絕啟動（不降級）

- 本版 approve 正確性依賴 git；靜默降級會造成「有的 store 有歷史、有的沒有」的雙行為。
- 依賴與 Bun／Agent CLI 同級，文件出貨時寫明。

## 為何 migration 用 Agent prompt／skill

- 產品尚未強調對外自動 migrate CLI；結構轉換（尤其 trim Current）用可審的 Agent 步驟＋脚本即可。
- 必須自足寫清；不可依賴「我們聊天時說的」。

## 否決／延後

| 項 | 原因 |
|----|------|
| 入夢直寫 live | 見上；與 pending activities、Seek 可見性衝突 |
| 整庫 hard reset | 誤傷 L0；與 G1 不相容 |
| `dreams/` 進 git | 噪音；可重跑 |
| 遠端 GitHub 同步 | 非本版；local 事務即可 |
| 半套 shipped | 舊新管線並存會讓契約與測試永久分叉 |
