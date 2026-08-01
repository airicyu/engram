# Migrate 0.18 → 0.19（node score 補檔）

← [INDEX](../INDEX.md) · 執行入口：[engram-migration skill](../../../../.claude/skills/engram-migration/SKILL.md)

> **結構世代：** 0.18 與 0.17 在「無 node score 檔」上同形；本 hop 自 **0.17.x–0.18.x**（及缺鍵但磁碟已是 0.17 未來視雙區者，若 skill 既有准入規則）升到 **`store_version: 0.19.0`**。  
> 精確准入區間以 skill 內 hop 檔為準；本檔寫 **要做什麼**。

## 產品句

為每個已存在 L2 node 建立預設活躍分檔，並建立全域 `max_score` registry，不改 `what.md`／chain／未來視內容。

## 步驟（機械）

1. 確認 store 為可寫 git 工作樹（對齊既有 migrate 慣例）。
2. 列出 `memories/nodes/*/` 目錄為 node id。
3. 對每個 id：若無 `score.yaml`，寫入：
   ```yaml
   score: 100
   score_timestamp: <migrate_as_of ISO>
   ```
   （`100`＝`S0`；已有合法 `score.yaml` → **不覆寫**。）
4. 寫／更新 `memories/node-score-registry.yaml`：
   - `max_score`＝全體 `score.yaml` 之 max；若 0 個 node → 可寫 `max_score: 0` 或不建檔（與 runtime「未初始化」一致；**偏好**：0 node 時寫 `max_score: 0` 或省略檔，runtime 皆須能處理）。
5. 更新 `engram.workspace.yaml`：`store_version: 0.19.0`（保留其他鍵）。
6. `git add`＋commit（message 前綴約定寫進 skill，例：`engram: migrate store 0.18→0.19 node scores`）。

## 不做

- 不改 `what.md`、chain、future-sight、dreams/
- 不回溯「歷史夢」重算分數（全體從 `S0` 起算）
- 不呼叫 downscale

## 驗收

- [ ] 每個既有 node 有 `score.yaml` 且缺檔者為 `S0`
- [ ] registry `max_score` 正確（全 `S0` → 100）
- [ ] `store_version == 0.19.0`
- [ ] 可 `GET /memories/nodes` 見 `display_score`（全 100 若皆 S0）
