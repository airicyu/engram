# 0.16.0 補丁 — `store_version`（記憶庫結構世代）

← [INDEX](../INDEX.md) · migrate 執行：[engram-migration skill](../../../../.claude/skills/engram-migration/SKILL.md)

> **狀態：** 併入 0.16.0（正式對外 release 前追加）；**結構世代／hop 鏈**規則於後續產品討論定案後寫入本檔（與 0.18 起「無結構變更仍可 stamp 產品版」並存）。  
> **產品句：** 每個記憶庫在 `engram.workspace.yaml` 記下自己的結構世代，多個 store 並列時不必靠猜才能選 migrate hop。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 位置 | **`{ENGRAM_STORE_DIR}/engram.workspace.yaml`** 鍵 **`store_version`**（與 `timezone`／`memory_language` 同檔；進 store git） |
| 2 | 語意 | **磁碟結構世代**（不是「上次用哪版 binary 開過」）。migrate 成功後才升到**新結構**目標版 |
| 3 | 格式 | 完整 semver 字串，例：`"0.16.0"`。Hop／世代比對取 **major.minor**（`0.16`）即可 |
| 4 | 缺鍵 | **合法**；`GET /status.store_version` = `null`（視為 pre-0.16／未標記） |
| 5 | 非法值 | 鍵存在但非 `X.Y.Z` → 與既有 workspace 一樣 **拒絕啟動** |
| 6 | 與產品版不一致 | **不拒啟**；status 同時回 `product_version` 供對照 |
| 7 | 禁止 | Server **啟動時不得**把既有／缺漏的 `store_version` 偷偷改成當前產品版（避免舊庫誤標） |
| 8 | 產品版 ≠ 結構代 | **結構沒變的 release**（例 0.18）可不 migrate、不強制 bump 舊庫；但**新建** store 仍可 stamp 當下 `product_version`。因此同一磁碟形狀上可能出現多個 `store_version` 字串（例 `0.17.0`…`0.24.0`） |
| 9 | 同代區間 | Migrate **按結構世代**，不按每個產品 minor。同一結構代內的所有 `store_version`（例假設 0.17–0.24 未改盤）→ **同一支 hop** 進入下一結構代；hop 檔須寫明准入區間 |
| 10 | 跨代 | 使用者落後多個結構代 → **逐代 hop 鏈**（每次一個世代：自檢 → stamp → 再下一跳）。禁止「任意舊版直達最新」的巨石腳本 |

## 結構世代 vs 產品版（例）

```
產品發行:  0.17  0.18  0.19 … 0.24  0.25
結構代:    |←──── 同一代（雙區 future-sight 等）────→|  |← 新代 →|
store_version 字串可能是 0.17.0 … 0.24.0，磁碟形狀仍等價
到 0.25 改盤時：只加 migrate-0.17-to-0.25（准入 0.17.x–0.24.x）
若中間 0.20 也改過盤：則 hop 鏈為 …→0.17→0.20→0.25
```

（上表數字為說明用；真實邊界以各 hop 檔與 roadmap 為準。）

## 誰寫入

| 時機 | 行為 |
|------|------|
| Setup wizard 新建 workspace | 寫入當前產品 `version.md` |
| `ensureEngramHome` 且 **尚無** workspace 檔 | 建立檔並帶 `store_version`（有效 timezone／language 可一併寫） |
| 已有 workspace 但缺鍵 | **不自動補** |
| 某結構 hop migrate 成功 | set／補該 hop 的目標 `store_version`（保留既有 timezone／language／其他鍵） |

## 誰讀取

| 消費者 | 行為 |
|--------|------|
| `GET /status` | `store_version`（`string \| null`）＋ `product_version`（產品 `version.md`） |
| `engram-migration` skill | **優先**讀 `store_version` 選**下一結構 hop**；同代多字串歸同一 hop；缺漏才啟發式／問使用者 |

## 驗收

- [x] 新建 store（wizard／ensure 無 workspace）有 `store_version`＝產品版
- [x] 缺鍵 store 可啟動；status 為 `null`
- [x] 非法 `store_version` → 拒啟（與既有 workspace 契約一致）
- [x] migrate 0.15→0.16 後 workspace 為 `0.16.0`
- [x] api-docs／migration SKILL／changelog 已同步
- [x] 文件寫明：無結構變更亦可 stamp 產品版；migrate 按結構代／逐代鏈（見上 #8–#10）
