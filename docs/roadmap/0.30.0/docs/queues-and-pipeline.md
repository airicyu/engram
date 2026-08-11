# 0.30.0 — Clarify queues、檔案結構、API、dream 階段

← [INDEX](../INDEX.md)

做什麼以 INDEX 已定案為準；本檔寫 **HOW**（路徑、frontmatter、HTTP 形狀、pipeline 掛點），供實作與契約文件對齊。

---

## 1. 磁碟佈局（相對 store 根）

```text
memories/clarify/asking/{id}.md      # 進行中補問（僅問題）
memories/clarify/pending/{id}.md     # 已答／順帶補充，待 distill
memories/clarify/history/{id}.md     # approve 後備份；產品不再讀
```

- 進 store git（與 `memories/nodes/**` 同級追蹤）。
- 啟動／首次寫入時 `ensureClarifyDirs()` 建三空目錄；舊庫無目錄不算壞（仿 0.29 `_attachments`）。
- **無** migrate hop；**不**抬 boot gate（仍 ≥ 0.28）；新建／migrate 仍可 stamp 產品版字串 `0.30.0`。
- `{id}`＝uuid v4（無花括）；檔名＝`{id}.md`；禁 path traversal。

---

## 2. Markdown 固定結構

### 共用 frontmatter

| 欄 | 型別 | 必填 | 說明 |
|----|------|------|------|
| `id` | string | 是 | 與檔名 stem 一致 |
| `kind` | `prompt`｜`aside` | 是 | `prompt`＝系統補問；`aside`＝順帶補充 |
| `created_at` | ISO-8601 | 是 | 建立時（有效時鐘） |
| `answered_at` | ISO-8601｜省略 | pending／history | submit／aside 寫入時；asking **無**此欄 |
| `source_dream_run_id` | string｜`null` | 是 | generate 寫入的補問＝該輪 `dream_run_id`；aside＝`null` |
| `related_nodes` | string[] | 是（可 `[]`） | generate 可填提示；aside 預設 `[]`；distill **不**強制依賴 |

### Body

| Queue | `kind` | 標題段 |
|-------|--------|--------|
| asking | `prompt` | 僅 `## Question`（非空） |
| pending／history | `prompt` | `## Question`＋`## Answer`（皆非空） |
| pending／history | `aside` | **無** `## Question`；僅 `## Answer`（非空）＝順帶補充正文 |

校驗失敗（缺欄、kind 非法、標題段不符、正文超 **16KiB** UTF-8、`related_nodes` >16）→ API **400**；dream generate 產出不合規 → 該則不落盤並可觀測 log（勿半套壞檔）。

`related_nodes`：元素非空 string、去重；**不**要求 live node 必存在。

### 檔名範例（asking）

```markdown
---
id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
kind: prompt
created_at: "2026-08-11T12:00:00.000+08:00"
source_dream_run_id: "20260811T120000-abcd"
related_nodes: ["acme"]
---

## Question

這次談的「上線」是指內部 beta 還是對外 GA？
```

### 順帶補充（pending）

```markdown
---
id: "…"
kind: aside
created_at: "…"
answered_at: "…"
source_dream_run_id: null
related_nodes: []
---

## Answer

補充：Acme 合約其實是兩年不是一年。
```

---

## 3. HTTP API

前綴 **`/memories/clarify`**（與 future-sight／nodes 同屬 memories 讀寫面）。  
空集合 → **200**＋`[]`（不 404）。

### `GET /memories/clarify/asking`

```json
{
  "items": [
    {
      "id": "…",
      "kind": "prompt",
      "created_at": "…",
      "source_dream_run_id": "…",
      "related_nodes": ["acme"],
      "question": "…"
    }
  ]
}
```

- 只列 `asking/`；按 `created_at` **舊→新**（先問先答）。
- 可選：本版可不做 `GET pending`（UI 不需；debug 可讀檔）。**定案：本版不暴露 list pending／history HTTP。**

### `POST /memories/clarify/asking/{id}/submit`

Body：`{ "answer": "…" }`（trim 後非空；UTF-8 ≤16KiB）。

1. 取得 clarify 寫互斥（capture lock 或 `clarify_write`）
2. 讀 asking 檔；不存在 → **404**
3. 寫 pending：同 id，補 `answered_at`、`## Answer`
4. 刪 asking 檔
5. git commit（prefix 建議 `engram: clarify submit`）

成功：**200** `{ "id", "queue": "pending" }`。同 id 二度 submit（已不在 asking）→ **404**。

### `DELETE /memories/clarify/asking/{id}`

- dismiss＝真刪 asking 檔；缺檔 → **200** 冪等。
- **不**進 history。
- git commit（若有刪到檔）。

### `POST /memories/clarify/aside`

Body：`{ "raw": "…" }`（trim 後非空；≤16KiB；欄位名 **`raw`** 與 activities 對齊語感，但**不**寫 L0）。

1. 取得 clarify 寫互斥
2. 新 uuid → 寫 `pending/{id}.md`（`kind: aside`）
3. git commit（`engram: clarify aside`）

成功：**201** `{ "id", "queue": "pending" }`。

### Lock／互斥

| 狀態 | submit／dismiss／aside |
|------|-------------------------|
| dream **lock**（run／approve 進行中） | **409** `dream_locked` |
| `pending_review` | **允許**（與 activities 相同：審夢期間仍可答補問／寫順帶補充） |
| 無 pending、無 lock | 允許 |

---

## 4. 入夢 pipeline 掛點

既有順序（摘要）後接：

```text
… → rollup cascade → finalizeDraft → involvements 校驗
  → 快照 pending ids → DreamRunState.clarify_pending_snapshot_ids
  → clarify_distill     # 讀 live pending 整包；只改／可建 draft nodes/{id}/{id}.md
  → finalizeDraft       # 再掃一次 draft（納入 distill 變更）
  → clarify_generate    # server 校驗後寫 live asking/＋commit；禁止擴 agent live writable
  → finalizeDreamReport # 含 ## Clarify distill
  → writeDreamRun → pending_review
```

| 規則 | 行為 |
|------|------|
| Rollup-only | 仍跑兩 job；夢內容不足 → 走 score top 8；**無任何 node** → generate no-op |
| Pending 空 | distill no-op（快照 `[]`）；generate 仍跑 |
| Distill 白名單 | 僅 draft `memories/nodes/{id}/{id}.md`（含 **create**）；違規寫入 **剔除**＋log，不整夢失敗 |
| Distill 硬失敗 | runner 崩／逾時 → 整夢失敗、清 draft、不 pending_review；`DreamIncompleteError.phase`＝**`materialize`** |
| Generate 落盤 | agent **無** live memories 寫權；只出結構化結果；server 組批校驗 → 寫 `asking/` → `stageAndCommitPaths`（`engram: clarify generate {dream_run_id}`） |
| Generate 部分失敗 | 組批一次寫入為佳；若逐則後整夢失敗 → best-effort 刪本 job 已寫 id |
| Job phase UI | 不新增 `DreamJobPhase`；events／log 標 `clarify_distill`／`clarify_generate` |

### Generate 選材

1. 優先：本輪夢內容（report Narrative／draft 變更摘要）。
2. 不足（含 rollup-only）：live nodes 依 **`score` 降序**取 **top 8**（缺失視同最低）。
3. **避開**本輪 involvements `update`｜`focus`；不足再補高分。
4. Store 無 node → **no-op**。
5. 新產 **3–5** 則；寫入後 asking >10 → 同 job prune 至 ≤10。

Prompt：`server/src/agent/` 下獨立 clarify distill／generate 分檔。

### Report 段序（固定）

```text
… → ## Node score involvements
  → ## Higher chain rollup …（若有）
  → ## Clarify distill
  → ## Structure notes
  → ## Appendix — pending deploy
```

- 空 distill → `_None_`。
- `extractNarrative`／rollup 截斷正則一律把 `## Clarify distill` 列為邊界。

### `GET /dreams/pending` 擴充

`present: true` 時 **`draft_summary` 必為物件**（無其他 draft 變更亦可 `entry_count: 0`）：

```json
{
  "entry_count": 0,
  "chain_days": [],
  "chain_summary_days": [],
  "chain_weeks": [],
  "chain_months": [],
  "chain_years": [],
  "future_ids": [],
  "clarify_distilled_node_ids": ["acme"]
}
```

- 真相＝distill job／server 記錄（與 `clarify_pending_snapshot_ids` 分離）；無變更 → `[]`。

### Distill 快照

- 欄位：`DreamRunState.clarify_pending_snapshot_ids: string[]`（寫在 `dreams/runs/{id}` 狀態；**不要**以 report 正文為唯一真相）。
- 時機：distill **開始前** listing `pending/`。

---

## 5. Approve／Discard／Retry／Amend

| 動作 | Clarify 行為 |
|------|----------------|
| **Approve** | deploy（若有）成功後：快照∩仍在 pending → **move history**；納入該次 dream git。**無論** `empty_patches`，快照非空就要歸檔。deploy 失敗 → **不** move。`l1_clear_pending` 路徑 **不再**歸檔。歸檔失敗 → log＋可重試，勿假裝已歸檔。 |
| **Discard** | 只丟 draft；**asking／pending 不動**；**不得**刪 asking |
| **Retry** | discard pending dream 前／後：先 **真刪** `source_dream_run_id` 屬於舊 pending run（及 retry 鏈被取代 run）的 asking；再整段 pipeline（含兩 clarify job）。`pending/` 不動 |
| **Amend** | **不**重跑 clarify、**不**重拍快照、**不**刪 asking；接受按舊快照歸檔 |

---

## 6. Housekeep（本版）

| 項 | 定案 |
|----|------|
| history 分桶 | **不做**；flat `history/{id}.md` |
| history 上限／GC | **不做** |
| asking TTL | **不做**；僅上限 10＋generate prune＋人 dismiss |

---

## 7. Web

| 項 | 定案 |
|----|------|
| 場景 id | `clarify` |
| Topbar 順序 | `activities` → `consolidate` → `clarify` → `seek` → `memory` |
| i18n | 中：`釐清`；英：`Clarify` |
| Badge | **本版不做** |
| 釐清 UI | 補問 cards＋順帶補充區 |
| Consolidate | report `## Clarify distill`；可選高亮 `clarify_distilled_node_ids` |
| Discard／Amend | UI／實作 **不得**順便清 asking |
