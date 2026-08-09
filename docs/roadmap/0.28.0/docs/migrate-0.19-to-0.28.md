# Migrate 契約：結構代 0.19–0.27 → 0.28（node 主檔）

← [INDEX](../INDEX.md) · 佈局細節：[node-layout.md](./node-layout.md)

> **執行真相**出貨時落在 `.claude/skills/engram-migration/migrate-0.19-to-0.28.md`＋script。本檔是 roadmap 契約／WHY 對照；兩邊必須一致。

## 產品句

把仍使用 `nodes/{id}/understand/what.md` 的記憶庫，機械遷到 `nodes/{id}/{id}.md`，刪除無意義 stub／空目錄，並 stamp `store_version: 0.28.0`，使 0.28+ server boot gate 通過。若有未審 dream，**離線丟棄**後再遷 live。

## 離線原則（防死結）

| 規則 | 說明 |
|------|------|
| **不經 HTTP** | Hop＝對 `ENGRAM_STORE_DIR` 跑 bun script／skill；**不需要** Engram server 已 listen |
| **Pending＝直接清空** | 不要求先 API discard／approve（避免與 boot 拒啟死結）；也不改寫舊 draft path（結構代已變，未審稿價值低） |
| **Boot 文案** | 拒啟時須提示：跑 `.claude/skills/engram-migration/`（本 hop 檔名），**無需先啟動 server**；並可知「未批准 dream 會被丟棄」 |
| **Escape** | `ENGRAM_ALLOW_STALE_STORE=1` 可警告後仍啟（除錯／救急）；**不是** migrate 的正常前置 |

## 准入

| 條件 | 說明 |
|------|------|
| `store_version` major.minor | **0.19–0.27**（含同結構代產品字串，例如庫 stamp 成 `0.27.0` 但磁碟仍為 what.md） |
| 或啟發式 | 存在 `memories/nodes/*/understand/what.md`，且主檔尚未是普遍的 `{id}.md` 佈局 |
| 已是 0.28 形狀 | 勿重跑破壞性步驟；抽樣確認後退出 |

跨更舊代：先跑既有 hop 鏈至 ≥0.19，再跑本 hop。各跳同樣離線執行。

## 步驟（契約）

1. **備份** store（skill 共用規則）。**必須先備份再清 pending**——清空不可逆。
2. **清空 pending（等價 discard，離線）：**
   - 若 `dreams/draft/` 非空或存在 status＝pending 的 dream run：記錄將丟棄的 `dream_run_id` 列表到 hop 日誌。
   - 刪除 `dreams/draft/*`（整棵 draft 樹）。
   - 將對應 dream run 狀態標為 **`discarded`**（或與現行 `discardPending` 等價的磁碟寫法；以 server `dream-runs` 契約為準）。
   - 若有 dream lock／in-flight job 指向該 pending → 釋放／標失敗或清除，避免升級後假鎖（script：刪 `dreams/dream.lock`）。
   - **不**刪除歷史已 `committed` 的 reports（除非既有 TTL／cleanup 另有約定）；本 hop 目標只是去掉「還在等審」的狀態。
   - stdout 明示：`discarded pending dream(s): …`
3. 對每個 live `memories/nodes/{id}/`：
   - `understand/what.md` → rename 為 `{id}.md`（同目錄上移到 node 根）。
   - 衝突（目標已存在且不同檔）→ fail 該庫。
   - 刪明顯 stub `INDEX.md`／`index.md`（見 node-layout heuristic）。
   - 移除空的 `understand/`。
4. `mkdir -p memories/_attachments` — **不做**（0.28 無附圖；見 INDEX #16）
5. 寫入 workspace `store_version: 0.28.0`。
6. 若 store 為 git：依 skill 慣例 commit（訊息需寫明 hop；可註 discarded pending ids）。
7. **自檢：** 無 `dreams/draft/*`（或僅空目錄）；無 pending run；抽樣 live 新路徑有檔、舊 what 無檔。

## 不做

- 改寫主檔**正文**（含自動加 wikilink）
- 改 L0 `events.jsonl`、chain 正文、future-sight 內容
- 經 API discard／approve 當 hop 步驟
- 把舊 draft **轉換**成新 path 後保留 pending（本版明確不採用）
- 刪除使用者自寫的非 stub `INDEX.md`（保守 heuristic）

## Boot gate

0.28+ binary：`peekStoreVersion` major.minor **≥ 0.28**，否則拒啟並提示本 hop（除非 `ENGRAM_ALLOW_STALE_STORE=1`）。
