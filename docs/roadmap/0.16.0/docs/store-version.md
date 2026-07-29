# 0.16.0 補丁 — `store_version`（記憶庫結構世代）

← [INDEX](../INDEX.md)

> **狀態：** 併入 0.16.0（正式對外 release 前追加）。  
> **產品句：** 每個記憶庫在 `engram.workspace.yaml` 記下自己的結構世代，多個 store 並列時不必靠猜才能選 migrate hop。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 位置 | **`{ENGRAM_STORE_DIR}/engram.workspace.yaml`** 鍵 **`store_version`**（與 `timezone`／`memory_language` 同檔；進 store git） |
| 2 | 語意 | **磁碟結構世代**（不是「上次用哪版 binary 開過」）。migrate 成功後才升到目標版 |
| 3 | 格式 | 完整 semver 字串，對齊產品 `version.md`，例：`"0.16.0"`。Hop 比對取 **major.minor**（`0.16`）即可 |
| 4 | 缺鍵 | **合法**；`GET /status.store_version` = `null`（視為 pre-0.16／未標記） |
| 5 | 非法值 | 鍵存在但非 `X.Y.Z` → 與既有 workspace 一樣 **拒絕啟動** |
| 6 | 與產品版不一致 | **不拒啟**；status 同時回 `product_version` 供對照 |
| 7 | 禁止 | Server **啟動時不得**把既有／缺漏的 `store_version` 偷偷改成當前產品版（避免 0.15 誤標 0.16） |

## 誰寫入

| 時機 | 行為 |
|------|------|
| Setup wizard 新建 workspace | 寫入當前產品 `version.md` |
| `ensureEngramHome` 且 **尚無** workspace 檔 | 建立檔並帶 `store_version`（有效 timezone／language 可一併寫） |
| 已有 workspace 但缺鍵 | **不自動補** |
| `migrate-0.15-to-0.16` 成功 | set／補 `store_version: 0.16.0`（保留既有 timezone／language） |

## 誰讀取

| 消費者 | 行為 |
|--------|------|
| `GET /status` | `store_version`（`string \| null`）＋ `product_version`（產品 `version.md`） |
| `engram-migration` skill | **優先**讀 `store_version` 選 hop；缺漏才啟發式／問使用者 |

## 驗收

- [x] 新建 store（wizard／ensure 無 workspace）有 `store_version`＝產品版
- [x] 缺鍵 store 可啟動；status 為 `null`
- [x] 非法 `store_version` → 拒啟（與既有 workspace 契約一致）
- [x] migrate 0.15→0.16 後 workspace 為 `0.16.0`
- [x] api-docs／migration SKILL／changelog 已同步
