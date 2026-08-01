# Dream × Node score — artifact、report、approve、2a

← [INDEX](../INDEX.md) · 分數公式：[node-score.md](./node-score.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫入夢與人審如何接到分數系統。

## 角色分工

| 角色 | 做 |
|------|-----|
| Extract AI | 寫 draft 記憶檔；寫 **involvements artifact**（只含 id＋category［＋可選 reason］） |
| `finalizeDreamReport` | Server 生成／覆寫 **`## Node score involvements`**（讀 artifact）；組裝 Scope／Events／Appendix |
| Extract 收尾校驗 | 非法 category → **失敗、不進 pending_review** |
| `approveDream` | 非 empty_patches：`commitDraft` → live 分數結算 → git（含 score 路徑） |
| Downscale flow | 見 node-score；不知 dream；可收 `exclude_node_ids` |
| 2a API | pending 時改 artifact category；觸發 report 段重寫／同步 |

## Involvements artifact

路徑（實作可微調，須先改本檔）：

`dreams/draft/{run_id}/node-score-involvements.yaml`

```yaml
nodes:
  - id: acme
    category: focus
    reason: "本輪主線在 Acme 釋出"   # 可選；給人審
  - id: alice
    category: mention
```

- AI **只**寫 `nodes[]`（及可選 reason）。
- **禁止** AI 填 `score`／`new_score`／`need_downscale`／`max_score`。
- 同 `id` 多列 → server 收斂為 **最高** category 再結算／展示。
- 本場 **新建** 的 id：可不上表；若上表 → **結算忽略**（仍以 `S0` 建檔）。

### 校驗（已定案）

| 情況 | 行為 |
|------|------|
| 任一列 category ∉ `{mention,update,focus}` | Extract **不得**進入 `pending_review`（失敗／錯誤態；可再 run 或 retry） |
| `id` 在 live 與本場 create 皆不存在 | **skip** 該列＋report／log 警告；其餘列保留 |
| 缺 artifact 檔 | 視同 `nodes: []`（允許：本輪無既有 node 涉及）；仍進 pending |

## Report 段

### 位置與所有權

- 標題固定：`## Node score involvements`
- 插在 **`## Narrative` 與 `## Appendix — pending deploy` 之間**
- **Server-owned**：`finalizeDreamReport` 依 artifact 生成／覆寫；AI 若在 report 自寫該段，finalize 時以 artifact 為準蓋掉
- 結算真相：**artifact**（含 2a 改後），不是人手改 markdown 而未改 artifact

### 形狀（例）

```markdown
## Node score involvements

| node | category | reason |
|------|----------|--------|
| acme | focus | … |
| alice | mention | … |
```

無列 → 段內 `_None_`。

### 與 `report-finalize.ts` 接點

現行 `extractNarrative` 用 `(?=\n## Appendix — pending deploy\b|$)` 截斷。本版改為：

- 截斷點：**`## Node score involvements` 或 `## Appendix — pending deploy`**（先到為準），避免 involvements 被併入 Narrative
- `assertReportSkeleton`：**不**強制 AI 預寫 involvements 標題（server 會加）；仍強制既有 Narrative 子標題
- Finalize 組裝順序（鎖定）：Retry feedback? → Scope → Events covered → **Narrative** → **`## Node score involvements`（server）** → **rollup_section（若有）** → **Appendix**

錨點：`server/src/dream/report-finalize.ts`。

## `GET /dreams/pending`

在既有 pending payload 上增加：

```json
"node_score_involvements": [
  { "id": "acme", "category": "focus", "reason": "…" }
]
```

- 無 artifact／空 → `[]`
- 同 id 多列已收斂為最高 category
- Consolidate／2a UI **以本欄為準**（report 僅人讀）

## Approve 編排（對照 `approveDream`）

錨點：`server/src/dream/run.ts` 的 `approveDream`（約：draft maintain → autosave → `empty_patches` 分支 → `commitDraft` → clear short-term → `stageAndCommitPaths`）。

### `empty_patches`

定義與現碼一致：`!(manifest.entries.length) && !deletes.length`。

| | 行為 |
|--|------|
| `empty_patches === true` | **不** `commitDraft`；**不**跑分數結算；仍可清 short-term／既有 git 語意 |
| clear-only approve（`l1_clear_pending`） | **不**再跑分數（部署已在先前完成） |

即使 artifact 非空但 `empty_patches`：本版仍 **不結算**（無檔案部署＝本場不改 L2 活躍分）。

### 非 empty_patches 成功路徑

```text
0. （既有）future-sight draft maintain；autosave dirty snapshot
1. commitDraft(pending.id) → live 記憶檔部署；取得 committed[]
2. C = 本場新建 node id 集合（seed／新目錄；由 manifest／draft 推導）
3. 讀 involvements（2a 後之 artifact）；對 id ∉ C 且 live 存在：
     score += boost[category]；寫 live score.yaml
4. 若任一（剛寫後）score > S_max：
     downscale({ as_of, exclude_node_ids: C })
5. 對每個 id ∈ C：寫 live score.yaml = { score: S0, score_timestamp: as_of }
6. 重算並寫 registry.max_score
7. clear short-term（既有）
8. stageAndCommitPaths(committed ∪ score/registry 相對路徑 ∪ short-term…)
9. removeDraft（既有）
```

- 分數寫在 **live**（`ENGRAM_STORE_DIR`），不是只留在 draft（draft 將刪）。
- `commitDraft` 拋錯 → 不寫分；沿用既有 path 回滾。
- 分數已寫、git commit 失敗 → 對齊現況：live 已變、log error、不在此強行 rollback L2（含 score）。

**as_of**：approve 時刻 ISO（有效 clock／timezone）。

discard／retry：**不**執行分數步驟。

## 本場人審（本版）

| # | 動作 | 本版 |
|---|------|------|
| 1 | approve | ✓；非 empty_patches 含分數結算 |
| 2a | 結構化改 category | ✓ |
| 2b | 自由句改 draft | ✗ backlog |
| 3 | retry + reason | ✓；重抽後新 artifact |
| 4 | discard | ✓ |

## 2a — 結構化改 category

**何時：** `pending_review`。本版 **只允許改 artifact 已有 id 的 category**（不新增／刪列）。

`PATCH /dreams/pending/node-score-involvements`

```json
{ "id": "acme", "category": "update" }
```

| 情況 | 回應 |
|------|------|
| 成功 | 200；改 artifact；重寫 report involvements 段；pending 再 GET 見新 category；**不**改 live score |
| 非法 category | **400** `invalid_category` |
| 無 pending | **409**／對齊既有 no-pending 碼 |
| id 不在 artifact | **404** `involvement_not_found` |

UI：Consolidate 讀 `node_score_involvements`，下拉改完打 PATCH。

## Browse 回應（讀側）

`GET /memories/nodes` 每筆與 `GET /memories/nodes/{id}`：

| 欄位 | 說明 |
|------|------|
| `score` | 帳面；無檔 → `null` |
| `display_score` | `ceil` 結果；無法算 → `null` |
| `score_timestamp` | **detail 必回**（有檔時）；index 可省略 |

**不**加 `?sort=score` 本版。

## Prompt 要點（dream-files）

- 寫 involvements artifact（路徑見上）。
- 只評 **本場前已存在** 且本輪有涉及之 node；新建略過 category。
- 僅 `mention`｜`update`｜`focus`；勿寫分數。
- Report 可不手寫 involvements 表（server finalize 會生成）；若寫了也會被覆寫。
