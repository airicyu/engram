# 0.16.0 — 由 0.15 store migrate 至 0.16

← [INDEX](../INDEX.md)

> 本檔是 roadmap **結構差／契約**。  
> **給人叫 Agent 執行的入口：** [`.claude/skills/engram-migration/`](../../../../.claude/skills/engram-migration/SKILL.md)（路由器）＋ [`migrate-0.15-to-0.16.md`](../../../../.claude/skills/engram-migration/migrate-0.15-to-0.16.md)（本 hop）。  
> **不做：** 重放歷史 dream／改寫歷史 `patches.jsonl` 內容。

---

## A. 結構差（0.15 → 0.16）

| 項目 | 0.15 | 0.16 目標 |
|------|------|-----------|
| Store git | 無 | 根目錄 `.git`＋`.gitignore`（`tmp/`、`dreams/`） |
| `engram.workspace.yaml` | 可有 | 納入 git 追蹤 |
| `memories/**` | 普通檔 | 納入 git |
| Day／node 正文 | `## Current`＋`## History` | 整檔＝原 **Current** 正文；**丟棄 History 內容**（不另檔保存） |
| Day ledger | 常有 `# YYYY-MM-DD` | 去掉該 heading；保留 patch metadata blocks |
| Week summary | `…/weeks/{YYYY-MM}/{YYYY-Www}.summary.md` | **`…/{YYYY-Www-MMDD}.summary.md`**（`MMDD`＝週一）；`initialized_weeks.yaml` 同步；見 [week-id-mmdd.md](./week-id-mmdd.md) |
| `store_version` | （通常缺） | `engram.workspace.yaml` 寫入 **`0.16.0`**；見 [store-version.md](./store-version.md) |
| `dreams/patches.jsonl` | 入夢驅動 | 不再驅動；檔可留可不留 |
| Draft／report 形狀 | patch materialize | 新管線產生；舊 pending draft **建議 discard 後再入夢**（migrate 不轉換進行中的 draft） |

### Summary／what 機械改寫規則

對每個 `memories/chain/days/**/*.summary.md` 與 `memories/nodes/*/understand/what.md`：

1. 若存在 `## Current`：取出 Current 與下一 `## History`（或 EOF）之間的正文，trim 後作為**整份新檔**。
2. 若無 `## Current`：視全文已是正文（可能已是 0.16），不改或僅 trim。
3. **刪除** `## History` 及其後全部內容（不遷移進新檔）。
4. 寫回同一 path（UTF-8，結尾單一 newline）。

### Ledger 機械改寫規則

對每個 `memories/chain/days/**/*.md`（排除 `*.summary.md`）：

1. 若第一個非空行匹配 `# YYYY-MM-DD`（且與檔名日期一致或純日期標題）→ 刪除該行及緊隨的單一空行。
2. **保留**所有 `<!-- patch:… -->`／`### patch:…` blocks 與正文。

---

## B. 執行入口（已定路徑）

| 檔 | 職責 |
|----|------|
| `.claude/skills/engram-migration/SKILL.md` | 通用：選 hop、備份、共用規則；可問使用者 from／to |
| `.claude/skills/engram-migration/migrate-0.15-to-0.16.md` | 本 hop 完整步驟＋自檢（須自足；與上方 A 節一致） |

之後新版本：在同一 skill 目錄加 `migrate-{FROM}-to-{TO}.md`，並更新 `SKILL.md` 表格。

---

## 驗收（Track 5）

- [x] `engram-migration` skill 目錄存在；含本 hop 檔且與 A 節一致
- [x] 對一份 0.15 形狀 fixture 執行 hop 後，通過 hop 檔自檢清單
- [x] 升級後的 store 可被 0.16 server ensure 啟動（git 已存在則不破壞歷史）

機械腳本（優先）：`.claude/skills/engram-migration/scripts/migrate-0.15-to-0.16.ts`
