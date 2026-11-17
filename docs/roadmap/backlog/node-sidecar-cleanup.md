# 清掉節點旁的 score.yaml 與 node.meta.yaml

**狀態：** 構想。尚未排進版本。

## 題意

0.6.0 把活躍分定為 node 主檔 frontmatter 的 `activity_score`（整數 0–100）。Import 應把 Engram 的 `nodes/{id}/score.yaml` 機械合併進 frontmatter。Distill 不維護分數。

真人庫（以及任何在該版之前匯入、或匯入時選擇保留旁檔的庫）仍同時存在 `score.yaml`，一部分節點還有 `node.meta.yaml`，主檔則沒有 frontmatter。讀的人會看到兩套狀態：契約說分數在主檔，磁碟上的分數在旁檔，而且 skill 兩邊都不當真相用。

要做成：

- 一次性、可重跑的機械整理（腳本或 import 的後處理，不經 Pi）：若 `score.yaml` 有 `score` 或 `activity_score`，且主檔 frontmatter 尚無合法 `activity_score`，寫入 frontmatter（0–100，超出則 clamp）。然後刪除該 `score.yaml`。
- 主檔已有合法 `activity_score` 時，不覆蓋，只刪旁檔（以主檔為準，對齊 0.6.0「import 以寫入 frontmatter 為準」）。
- `node.meta.yaml` 不在 Lite 契約內。整理時若內容只是 Engram 匯入殘留、沒有 Lite 要保留的欄位，刪除並在 dry-run 列出檔名。若有未記載欄位，dry-run 停下列出，不默默丟。
- 預設 dry-run；`--yes` 才寫。目標是使用者自己的 store 路徑，禁止把整理過程中讀到的正文寫進 repo。

## 可能要定（排進版本時寫進 INDEX）

- 腳本入口：`bun run` 一條子命令，參數 `--store <dir>`，與 `import:engram` 分開，避免為了清旁檔再跑一次全量匯入。
- `node.meta.yaml` 的允許清單：沒有要保留的鍵就整檔刪。不要把它翻譯成一套新的 node 設定格式。
- 驗收用隔離 fixture：有分數旁檔無 frontmatter、兩邊都有且數字不同、只有 `node.meta.yaml`、空節點目錄。不使用真人 vault。

## 不要當成題目的一部分

- Distill 或 server 開始計算、更新 `activity_score`
- 重新定義活躍分的語意（仍是顯示用快照）
- 為了清檔去改 chain 或 clarify
