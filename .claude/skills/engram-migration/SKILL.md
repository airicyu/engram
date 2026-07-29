---
name: engram-migration
description: >-
  Migrate an Engram memory store (ENGRAM_STORE_DIR) between product versions.
  Use when the user asks to upgrade/migrate store data, 升級記憶庫, migrate
  0.15→0.16, or run engram-migration. Reads version-specific files under this
  skill directory; does not invent migration steps.
---

# Engram Migration

Generic skill: **upgrade a memory store from one Engram version’s on-disk shape to another.**

This skill edits files **under `ENGRAM_STORE_DIR` only** (after backup). It is the opposite of `engram-workbench` (API-only). Do **not** modify the Engram product git repo’s source tree as part of migration.

## Layout

```
.claude/skills/engram-migration/
├── SKILL.md                      ← this file (router + shared rules)
└── migrate-{FROM}-to-{TO}.md     ← one file per supported hop
```

| File | Hop |
|------|-----|
| [migrate-0.15-to-0.16.md](./migrate-0.15-to-0.16.md) | 0.15.x store → 0.16.x store |
| [scripts/migrate-0.15-to-0.16.ts](./scripts/migrate-0.15-to-0.16.ts) | 本 hop 機械腳本（`bun … "$ENGRAM_STORE_DIR"`） |

Future hops: add `migrate-X.Y-to-A.B.md` in this directory and list it in the table above. **Do not** put hop-specific steps only in chat or only in roadmap without a file here.

Roadmap contract／WHY for 0.16: `docs/roadmap/0.16.0/docs/migrate-0.15-to-0.16.md`（結構差真相；執行以本 skill 目錄檔為準）。

## When invoked

1. **Resolve paths**
   - `ENGRAM_STORE_DIR`：使用者給的絕對路徑，或從 `server/.env`／環境變數讀取。不確定就問。
   - 確認該目錄像 Engram store（例如有 `memories/` 或 `engram.workspace.yaml`）。否則停止並說明。

2. **Resolve version hop**
   - 若使用者已說「0.15→0.16」等 → 選對應 `migrate-*-to-*.md`。
   - 若未說：先讀 `{ENGRAM_STORE_DIR}/engram.workspace.yaml` 的 **`store_version`**（完整 semver；比對 hop 用 **major.minor**）。例：`0.15.0`／缺鍵且磁碟仍像 0.15 → 選 `migrate-0.15-to-0.16.md`；已是 `0.16.x` → 告訴使用者可能已遷移，抽樣確認後不要重複破壞性改寫。
   - 若 `store_version` **缺漏**：再檢查啟發式（day summary／`what.md` 是否仍有 `## Current`／`## History`；是否已有 store `.git`；產品 `version.md`）。仍不確定 → **問使用者** from／to，並列出本目錄已支援的 hop。
   - 若要求的 hop **沒有**對應檔 → 停止；不要臆造步驟。告訴使用者需先新增 `migrate-{FROM}-to-{TO}.md`。

3. **Read the hop file completely** and follow it. Shared rules below still apply; hop file wins on conflicts for that hop.

4. **Execute**, then run the hop file’s checklist and report results to the user.

## Shared rules（所有版本 hop）

| Do | Don't |
|----|-------|
| 改檔前 **備份** 整個 store（旁鄰目錄 copy，或使用者書面確認已備份） | 未備份就改 live store |
| 優先用 **script** 做機械改寫 | 靠 LLM 逐檔「重寫正文」造成內容漂移 |
| 只動 hop 檔允許的路徑 | 改產品 repo 原始碼、或 `git add` 進 engram 應用 repo |
| `git -C "$ENGRAM_STORE_DIR"`（若 hop 需要 git） | 在錯誤 cwd 找到外層產品 `.git` |
| 跳過／先處理 pending draft（依 hop 檔） | 重放歷史 dream、改寫 L0 `events.jsonl` 歷史行 |
| 結束後逐項勾 hop 自檢清單 | 宣稱完成卻未抽樣驗證 |

## Adding a new hop（給之後的作者）

1. 新增 `migrate-{FROM}-to-{TO}.md`：結構差表、機械步驟、拒絕條件、自檢清單、非目標。
2. 更新本檔上方表格。
3. 若有 roadmap 版契約，與 skill 檔雙向連結；**執行步驟以 skill 目錄檔為準**。
