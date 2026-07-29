# 0.16.0 — 入夢檔案管線、report、deploy 原語

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫入夢／人審／部署 **HOW**。

## 產品流程

```
POST /dreams/run（lock）
  → 一套 dream prompt：AI 在 dreams/draft/{run_id}/ 作業
      · script copy live→draft（需要改的檔）
      · 編輯 draft 檔（file_update）
      · ledger：file_append 原語（sidecar 或等價）
      · 填 deletes 清單（可空）
      · 寫 reports/{run_id}.md（協定結構）
      · rollup 所需高階 summary 一併寫入同一 draft（若本輪需要）
  → pending_review（釋放 extract lock；deploy 另鎖）
  → 人：讀 report → approve｜discard｜retry

approve（lock）
  → deletes → deploy draft→live → git commit → 清 short-term scope S

discard → 丟 draft／pending 態
retry → discard 後同 scope＋reason 再 run
```

**保留：** 人審閘門、lock、pending 時可 activities、retry with reason。  
**廢除主路徑：** Agent 只輸出 typed `Patch[]` → server `materializeDraft` 依 operation 改檔。

## 檔案原語

### file_update

- 對象：幾乎所有敘事檔——`what.md`、day／week／month／year **summary**、future-sight、新建 node 目錄下的檔等。
- 做法：ensure draft 目錄 → **script copy** live 檔（若存在）→ AI **編輯 draft 內檔** → approve 時整檔部署覆蓋 live。
- 新建：draft 內直接建檔，deploy＝create。

### file_append（ledger only）

- 白名單：`memories/chain/days/**/*.md`，**排除** `*.summary.md`。
- **程式級 append-only**：deploy／執行時由 server／script 把本輪 block append 到 live（或先寫在 draft sidecar，deploy 時 `>>`）；AI **不得**用 file_update 覆寫整個 ledger 來「假裝 append」。
- Block 須含 **patch metadata**（保留 `<!-- patch:… -->` 與 `### patch:… · events:[…]` 或等價）；**不要**寫檔頂 `# YYYY-MM-DD`。

### deletes

- AI 在 draft 旁維護清單（如 `deletes.txt`）：每行一條相對 `ENGRAM_STORE_DIR` 的 path。
- Deploy **先**刪除（存在才刪）；path 必須落在允許前綴（至少 `memories/`），拒絕 `..` 與目錄逃逸。
- 空清單＝本輪無刪除。

## 正文格式（live／draft 相同語意）

| 檔 | 格式 |
|----|------|
| `{day}.summary.md` | **整檔＝最新當日敘事**；無 `## Current`／`## History` |
| `nodes/{id}/understand/what.md` | **整檔＝最新理解**；無 Current／History |
| week／month／year `*.summary.md` | 維持整檔 snapshot（已無 History） |
| day ledger `{day}.md` | 多 block append；每 block 有 metadata＋正文；無檔頂日期 heading |

## Report 協定（穩定結構）

檔案：`dreams/reports/{run_id}.md`。

AI 寫 **narrative 各節**；Appendix 路徑表可由 AI 草稿，但 **server 必須用 draft／deletes／appends 機械校對**後寫回或覆寫 appendix（INDEX #17）。

### 必填標題級（實作可微調用詞，但須穩定可解析）

```markdown
# Dream report — {dream_run_id}

## Scope
（將於 approve 清掉的 short-term event ids；server 可機械填）

## Events covered
（server 可機械填 raw 摘要）

## Narrative
### Timeline
### Long-term updates
### Near future
### Uncertainties
（無內容的節寫明 _None_ 或等價，勿省略標題）

## Appendix — pending deploy
### Paths
- create|update|delete|append `relative/path` （可選 +N −M）
  — 可選：一兩句說改了什麼（無聊可略）
```

### 不嵌入

- 完整 unified diff（可另存 `dreams/draft/{run_id}/diff.patch` 或 pending API 按需提供）。

## Agent 約束（prompt 必須寫明）

- 只改 `dreams/draft/{run_id}/` 下允許路徑；**不要**直接改 live `memories/`。
- 用工具／script copy，不要把大檔整份貼進模型輸出再當寫入。
- Report 遵守標題級；path blurb 寧缺勿濫。
- 記憶寫入語言遵守 workspace `memory_language`；時區／today 遵守有效 clock（同既有 extract 規則精神）。

## HTTP／UI（方向）

- 維持 `/dreams/*` 動詞；pending 回應以 **report markdown**＋touched paths 為主，不再要求客戶端理解 typed patch union。
- Consolidate：展示 report；approve／discard／retry 不變。
- 出貨同步 `docs/api-docs/`。

## Rollup

- Week／month／year 更新＝對對應 summary 做 **file_update** 進 **同一** `draft/{run_id}/`，與 day 變更同一人審、同一次 deploy／commit。
- 可仍分 planner／writer 子步驟，但產出必須落在 draft 檔，不得另走舊 patch materialize。
