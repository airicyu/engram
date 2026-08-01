# Store boot gate — 結構代不足拒啟

← [INDEX](../INDEX.md) · 上游語意：[0.16 store-version](../../0.16.0/docs/store-version.md)（本版 **修改** 缺鍵／過舊時的啟動行為）

> **做什麼以 INDEX 已定案為準。**

## 產品句

0.19+ server 啟動時若記憶庫 **結構代低於本 binary 所需最低代**（或缺 `store_version`），**拒絕啟動**並提示執行 migrate；**不**要求 `store_version` 字串等於 `product_version`。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 比對維度 | 只比 **major.minor** 結構代。`store_version`／所需最低皆取 major.minor |
| 2 | 本 binary 最低代 | **`0.19`**（完整提示字串可用 `0.19.0`）。僅在**改盤 hop** 時上調此常數；0.20 若未改盤仍要求 `>= 0.19` |
| 3 | 通過 | `peekStoreVersion()` 有合法 semver，且其 major.minor **≥** 最低代 |
| 4 | 拒啟：缺鍵／null | workspace 存在但無 `store_version`，或 ensure 後仍無有效值 → 拒啟（**推翻** 0.16「缺鍵可啟動」） |
| 5 | 拒啟：過舊 | 例 `0.17.0`／`0.18.2` 開 0.19 binary → 拒啟 |
| 6 | 通過：同代較新字串 | 將來同結構代 stamp `0.20.0` 但最低仍 `0.19` → **可啟**（字串可以新於最低代） |
| 7 | 仍不偷偷 stamp | 過舊／缺鍵時 **不得**自動改寫 workspace 冒充已 migrate（維持 0.16 #7） |
| 8 | 時機 | **`ensureEngramHome` 成功之後**（新建庫已 stamp 當前產品版）再檢查；未過則 `process.exit(1)`，**不** `Bun.serve` |
| 9 | 訊息 | stderr／log 須含：目前 `store_version`（或 `missing`）、所需 `>= X.Y`、指向 **`.claude/skills/engram-migration/`**（本 hop：`migrate-0.17-to-0.19`） |
| 10 | Escape hatch | `ENGRAM_ALLOW_STALE_STORE=1` → 印 **警告** 仍啟動（除錯用；預設關）。非法 semver 鍵仍走既有 workspace 拒啟，不受此開關 |

## 與 0.16 #4／#6 的關係

| 0.16 | 0.19+ |
|------|--------|
| 缺鍵可啟動，status `null` | **缺鍵拒啟**（除非 escape hatch） |
| 與 product_version 不一致不拒啟 | **維持**：仍不要求等於 product；改為相對 **最低結構代** |

## 驗收

- [x] 新建 store（ensure stamp）可啟動
- [x] `store_version: 0.18.0`（無 escape）→ 拒啟＋migrate 提示（`checkStoreStructure`／boot）
- [x] 缺 `store_version` → 拒啟
- [x] `0.19.0` → 可啟
- [x] `ENGRAM_ALLOW_STALE_STORE=1`＋舊版 → 警告後可啟（邏輯已實作）
- [x] api-docs／CLAUDE／changelog 已同步
