# 0.17.0 — 遷移契約 0.16 → 0.17

← [INDEX](../INDEX.md)

> **執行入口：** `.claude/skills/engram-migration/`（本版出貨時必須有 `migrate-0.16-to-0.17.md` hop）。  
> 本檔＝結構差與驗收；**勿**手改記憶庫當正式 migrate。

## 何時需要

`engram.workspace.yaml` 的 `store_version` 為 `0.16.0`（或缺鍵但磁碟仍為 `memories/future-sight/active/*.md` 形狀）→ 升到 **`0.17.0`**。

已是兩檔、無 `active/` 且 `store_version: 0.17.0` → 跳過。

---

## 結構差

| 項目 | 0.16 | 0.17 |
|------|------|------|
| 未來視活集合 | `memories/future-sight/active/{id}.md` | `hot.md`＋`later.md` |
| workspace | 無未來視窗長鍵 | 可寫入 `future_sight_window_days`／`future_sight_hot_days`（缺省即可；**不強制** migrate 寫入預設鍵） |
| `store_version` | `0.16.0` | `0.17.0` |

**不改：** nodes、chain、activities、short-term、dreams staging、git 進出規則。

---

## 步驟（邏輯順序）

1. **備份**（skill 既有規則）。
2. 讀有效 timezone；`T =` 遷移執行當日（牆鐘或文件註明用 store clock——**本版：遷移用主機當日在有效 timezone 下的日曆日**；不依賴虛擬 clock API）。
3. 讀 config：window／hot days（workspace／env／預設）。
4. 若存在 `active/`：用 **0.16 parse**（整檔 frontmatter 含 `id`＋正文）讀每個 `*.md`。
5. 對每個錨點套用與 runtime 相同的分桶規則（過期→寫 L0＋short-term 後丟棄，與 runtime 一致；出窗同理）。
6. **格式轉換（必做）：** 每個存活錨點寫成 0.17 item 形狀——`## {id}`＋**yaml fence**（**僅** `anchor_start`／`anchor_end`）＋舊正文。丟棄舊 frontmatter 的 `node_refs`／`event_refs`／`dream_run_id`／`committed_at`。
7. Render 完整 `hot.md`／`later.md`（檔級 `zone` frontmatter＋排序後的 items）；寫入磁碟。
8. 刪除 `active/` 目錄（及其中檔案）。
9. 更新 `engram.workspace.yaml`：`store_version: 0.17.0`（保留 timezone／memory_language／既有未來視鍵；**不強制**寫入 window／hot 預設鍵）。
10. `git add` 相關 path → commit（message 標明 migrate 0.16→0.17）。
11. Smoke：server 啟動；`GET /memories/future-sight` 200；必要時 mock dream 可讀兩檔。

---

## 不做

- 重放歷史 dream／patches
- 改寫 chain／nodes 正文
- 把遷移當成「手改 yaml／md」教學而無 skill hop

---

## 驗收

- [ ] 無 `memories/future-sight/active/`
- [ ] `hot.md`／`later.md` 可 parse；id 不重複；排序正確
- [ ] 原未過期錨點仍在某一區；已過期者不在兩檔
- [ ] `store_version: 0.17.0`
- [ ] 0.17 server 可啟動並 GET 未來視
