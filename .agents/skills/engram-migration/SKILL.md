---
name: engram-migration
description: >-
  Migrate an Engram memory store (ENGRAM_STORE_DIR) between product versions.
  Use when the user asks to upgrade/migrate store data, 升級記憶庫, migrate
  0.15→0.16, or run engram-migration. Reads version-specific files under this
  skill directory; does not invent migration steps.
---

# Engram Migration

Generic skill: **upgrade a memory store from one on-disk structure generation to the next.**

This skill edits files **under `ENGRAM_STORE_DIR` only** (after backup). It is the opposite of `engram-workbench` (API-only). Do **not** modify the Engram product git repo’s source tree as part of migration.

契約／世代語意：[`docs/roadmap/0.16.0/docs/store-version.md`](../../../docs/roadmap/0.16.0/docs/store-version.md)。

## 核心規則（結構世代）

| 規則 | 說明 |
|------|------|
| **Hop＝結構邊界** | 每個 `migrate-{FROM}-to-{TO}.md` 對應**一次磁碟形狀／內容契約變更**，不是每個產品 release 一支 |
| **同代多字串** | 結構未變的產品版仍可能 stamp 不同 `store_version`（例新建庫寫 `0.18.0`，形狀仍同 0.17）。**同一結構代**內所有 major.minor → **同一支 hop** 進入下一結構代；hop 檔必須寫清准入區間（例 `0.17.x`–`0.24.x`） |
| **跨代＝鏈** | 落後多個結構代時：**逐代**執行（跑完 A→B 自檢並 stamp → 再 B→C）。禁止臆造「任意舊版直達最新」 |
| **From 命名** | 檔名的 `{FROM}` 用**該結構代的代表／起始** minor（例 `migrate-0.17-to-0.25`），不要為 `0.18`/`0.19`…各寫一支等價腳本 |

## Layout

```
engram-migration/                 ← this skill directory (under agent skills root)
├── SKILL.md                      ← this file (router + shared rules)
├── scripts/                      ← mechanical hop scripts
└── migrate-{FROM}-to-{TO}.md     ← one file per structure hop
```

| File | Hop |
|------|-----|
| [migrate-0.15-to-0.16.md](./migrate-0.15-to-0.16.md) | 0.15.x store → 0.16.x store |
| [scripts/migrate-0.15-to-0.16.ts](./scripts/migrate-0.15-to-0.16.ts) | 本 hop 機械腳本（`bun … "$ENGRAM_STORE_DIR"`） |
| [migrate-0.16-to-0.17.md](./migrate-0.16-to-0.17.md) | 0.16.x store → 0.17.x store（未來視雙區） |
| [scripts/migrate-0.16-to-0.17.ts](./scripts/migrate-0.16-to-0.17.ts) | 本 hop 機械腳本 |
| [migrate-0.17-to-0.19.md](./migrate-0.17-to-0.19.md) | 0.17.x–0.18.x → 0.19.0（node score 補檔） |
| [scripts/migrate-0.17-to-0.19.ts](./scripts/migrate-0.17-to-0.19.ts) | 本 hop 機械腳本 |
| [migrate-0.19-to-0.28.md](./migrate-0.19-to-0.28.md) | 0.19.x–0.27.x → 0.28.0（node `{id}.md`；離線清 pending） |
| [scripts/migrate-0.19-to-0.28.ts](./scripts/migrate-0.19-to-0.28.ts) | 本 hop 機械腳本（**無需先啟動 server**） |
| [migrate-0.28-to-0.36.md](./migrate-0.28-to-0.36.md) | 0.28.x–0.35.x → 0.36.0（刪 `initialized_*.yaml`＋STM `nodes/`／summary） |
| [scripts/migrate-0.28-to-0.36.ts](./scripts/migrate-0.28-to-0.36.ts) | 本 hop 機械腳本（**無需先啟動 server**；不丟 pending） |

Future hops: add `migrate-X.Y-to-A.B.md` in this directory and list it in the table above. **Do not** put hop-specific steps only in chat or only in roadmap without a file here.

Roadmap contract／WHY for 0.16: `docs/roadmap/0.16.0/docs/migrate-0.15-to-0.16.md`  
Roadmap contract／WHY for 0.17: `docs/roadmap/0.17.0/docs/migrate-0.16-to-0.17.md`（結構差真相；執行以本 skill 目錄檔為準）。

## When invoked

1. **Resolve paths**
   - `ENGRAM_STORE_DIR`：使用者給的絕對路徑，或從 `server/.env`／環境變數讀取。不確定就問。
   - 確認該目錄像 Engram store（例如有 `memories/` 或 `engram.workspace.yaml`）。否則停止並說明。

2. **Resolve version hop（下一結構代）**
   - 若使用者已說明確 hop（如「0.15→0.16」）→ 選對應檔；若其目標仍不是使用者要的最終代 → 跑完後再選下一跳。
   - 若未說：先讀 `store_version`（比對 **major.minor**），對照本目錄 hop 表與各 hop 的**准入區間**選**下一跳**：
     - 例：`0.15.x`／缺鍵且像 0.15 → `migrate-0.15-to-0.16`
     - 例：`0.16.x` 或仍有 `future-sight/active/` → `migrate-0.16-to-0.17`
     - 例：`0.17.x`／`0.18.x`（無 node `score.yaml`）→ `migrate-0.17-to-0.19`
     - 例：`0.19.x`–`0.27.x` 或仍有 `nodes/*/understand/what.md` → `migrate-0.19-to-0.28`（離線；會丟棄未批准 dream）
     - 例：`0.28.x`–`0.35.x` 或仍有 `initialized_weeks.yaml`／STM `nodes/` → `migrate-0.28-to-0.36`
     - 例：已屬某 hop 寫明的「已達目標代」→ 告訴使用者可能已遷移，抽樣確認後不要重複破壞性改寫
   - 若 `store_version` 字串較新但**結構仍屬舊代**（產品 stamp、未改盤）：仍走該舊代的「離開 hop」，不要因字串是 `0.18` 就說「沒有 0.18→… 檔」而停住——應歸入 hop 檔宣布的同代區間。
   - 若 `store_version` **缺漏**：再檢查啟發式（day summary／`what.md` 是否仍有 `## Current`／`## History`；是否已有 store `.git`；未來視 `active/` vs `hot.md`／`later.md`）。仍不確定 → **問使用者**，並列出已支援的 hop。
   - 若下一跳 **沒有**對應檔 → 停止；不要臆造步驟或合併多代。

3. **Read the hop file completely** and follow it. Shared rules below still apply; hop file wins on conflicts for that hop.

4. **Execute**，勾 hop 自檢；若使用者目標仍更新的結構代 → **再從步驟 2 選下一跳**（逐代鏈）。

## Shared rules（所有版本 hop）

| Do | Don't |
|----|-------|
| 改檔前 **備份** 整個 store（旁鄰目錄 copy，或使用者書面確認已備份） | 未備份就改 live store |
| 優先用 **script** 做機械改寫 | 靠 LLM 逐檔「重寫正文」造成內容漂移 |
| 只動 hop 檔允許的路徑 | 改產品 repo 原始碼、或 `git add` 進 engram 應用 repo |
| `git -C "$ENGRAM_STORE_DIR"`（若 hop 需要 git） | 在錯誤 cwd 找到外層產品 `.git` |
| 跳過／先處理 pending draft（依 hop 檔） | 重放歷史 dream、改寫 L0 `events.jsonl` 歷史行 |
| 結束後逐項勾 hop 自檢清單 | 宣稱完成卻未抽樣驗證 |
| 跨代時一跳一跳跑完 | 發明單檔跨多個結構代的 shortcut |

## Adding a new hop（給之後的作者）

1. 確認這是**新的結構／內容契約邊界**（不是「又發了一個沒改盤的產品版」）。
2. 新增 `migrate-{FROM}-to-{TO}.md`：結構差表、**准入的 store_version 區間**（含同代多字串）、機械步驟、拒絕條件、自檢清單、非目標。
3. `{FROM}`＝上一結構代代表 minor；寫明哪些產品 stamp（例 0.17–0.24）都算 From 代。
4. 更新本檔上方表格。
5. 若有 roadmap 版契約，與 skill 檔雙向連結；**執行步驟以 skill 目錄檔為準**。
