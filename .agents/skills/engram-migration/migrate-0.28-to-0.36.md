# Migrate Engram store：0.28–0.35 → 0.36

← 路由器：[SKILL.md](./SKILL.md) · Roadmap 契約：[docs/roadmap/0.36.0/docs/migrate-0.28-to-0.36.md](../../../docs/roadmap/0.36.0/docs/migrate-0.28-to-0.36.md)

> **Hop：** 0.28.x–0.35.x → **0.36.0**。刪 0.11 殘留 `initialized_*.yaml`，以及短期記憶衍生檔（`summary.md`／`nodes/`）。  
> **全程離線**（不經 HTTP、**無需先啟動 Engram server**）。  
> **不做：** discard pending dream；改 L0／pool 既有列（空 pool 才可從 summary 回填）；改產品 repo `.git`。

## 何時用本檔

- 使用者要升級 **0.28–0.35** 記憶庫以配合 **0.36+** server（boot gate ≥ 0.36）。
- 線索：`store_version` major.minor ∈ 0.28–0.35；或仍有 `memories/chain/initialized_weeks.yaml`／`initialized_months.yaml`；或仍有 `memories/short-term-memory/nodes/`、`summary.md`。

若 store **已是** `store_version: 0.36.0`（或更高結構代）→ 告訴使用者可能已遷移；本 hop 冪等刪檔，但已 stamp ≥0.36 時腳本直接退出。

若仍是 **0.19–0.27**（`understand/what.md`）→ **先**跑 `migrate-0.19-to-0.28`，再跑本 hop。

## 前置

1. 取得 `ENGRAM_STORE_DIR` 絕對路徑；確認有 `memories/` 或 `engram.workspace.yaml`。
2. **備份：** 複製整個 store 到旁鄰目錄。**未備份不得改。**
3. **不必**先啟動 server。

## 結構差（摘要）

| 項目 | 0.28–0.35 | 0.36 |
|------|-----------|------|
| Chain 週／月／年索引 | 可能仍有 `initialized_{weeks,months,years}.yaml` | **刪除**（init＝summary 檔是否存在） |
| STM | 可能仍有 `summary.md`／`today-summary.md`／`nodes/` | **只留** `pool.jsonl`；空 pool 且 summary 有 event id → **先回填 pool 再刪** |
| `store_version` | `0.28.x`–`0.35.x` | **`0.36.0`** |

## 步驟（優先 script）

在 **本 skill 目錄**執行（會改 store；**須已備份**；**server 不必在跑**）：

```bash
bun ./scripts/migrate-0.28-to-0.36.ts "$ENGRAM_STORE_DIR"
```

腳本完成：

1. 刪 `memories/chain/initialized_weeks.yaml`、`initialized_months.yaml`、`initialized_years.yaml`（若存在）。
2. 若 `pool.jsonl` 空且 `summary.md`（或 `today-summary.md`）含 `(e…)` → 從 `events.jsonl` 回填 pool。
3. 刪 `memories/short-term-memory/summary.md`、`today-summary.md`、整個 `nodes/`。
4. Stamp `store_version: 0.36.0`。
5. 若 store 為 git：`git add`＋commit。

## 自檢

- [ ] 無 `memories/chain/initialized_*.yaml`
- [ ] 無 `memories/short-term-memory/nodes/`、`summary.md`、`today-summary.md`
- [ ] 若 hop 前 pool 空且 summary 有 id → `pool.jsonl` 有對應列
- [ ] `engram.workspace.yaml` → `store_version: 0.36.0`
- [ ] 0.36+ server 可啟動（boot 最低結構 **≥ 0.36**）

## 非目標

- 不 discard pending dream
- 不改寫 `events.jsonl` 歷史行
- 不抬／改 0.28 node `{id}.md` 契約
