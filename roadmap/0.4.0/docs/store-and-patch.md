# 未來視 — 存法與 patch

← [0.4.0 INDEX](../INDEX.md)

> 近程、可過期錨點庫；**不是** memory-chain 的未來延長，也不是 mindzone。

## 目錄（ENGRAM_HOME）

```
future-sight/
└── active/                 # 活集合（僅未過期）
    └── {id}.md
```

`ensureEngramHome` 建立 `future-sight/`、`future-sight/active/`。  
**無** `expired/` 或 `expired.jsonl`——過期痕跡走 L0 event，然後從活集合清掉（見 [expiry-and-api.md](./expiry-and-api.md)）。

### 活錨點檔（`active/{id}.md`）

YAML frontmatter + 正文：

```markdown
---
id: fs-2026-07-31-deadline
anchor_start: "2026-07-31"    # 必填；日級時 = 當日
anchor_end: "2026-07-31"      # 必填；短區間可 > start；日級 = start
node_refs: ["acme"]           # 可選
event_refs: ["evt_…"]
dream_run_id: "dream-…"
committed_at: "2026-07-22T12:00:00+08:00"
---

Engram deadline；與旅行可能撞期。
```

| 欄位 | 規則 |
|------|------|
| `id` | 穩定字串；extract 提供；同 id 再 commit = **覆寫**該活檔（revise 語意） |
| `anchor_start` / `anchor_end` | `YYYY-MM-DD`，Asia/Taipei；`start ≤ end`；皆須 **≥ 今日**（approve 當下校驗） |
| 日級 | `start == end` |
| 短區間 | 例如旅行 `2026-08-01`–`2026-08-05`；**不做**年齡帶／年級人生尺度 |

正文：短敘述即可；非待辦系統。

## Patch 類型：`future`

```json
{
  "type": "future",
  "patch_id": "p-…",
  "dream_run_id": "dream-…",
  "ts": "…",
  "event_refs": ["evt_…"],
  "id": "fs-2026-07-31-deadline",
  "anchor_start": "2026-07-31",
  "anchor_end": "2026-07-31",
  "content": "Deadline；與旅行可能撞期。",
  "node_refs": ["acme"]
}
```

| 規則 | |
|------|--|
| 與 `chain` | **互斥路徑**：未來日不得再當 `chain.id`；近程前瞻用 `future` |
| Materialize | `draft/{run}/future-sight/active/{id}.md`；manifest `op: create` \| `update` |
| Commit 順序 | 可與 chain／semantic 同 run；無強制先後（不依賴 node create 亦可；`node_refs` 僅引用） |
| Approve 校驗 | `anchor_end < today` → **409** `stale_future_anchor` + ids（pending 保留，比照 `future_chain_id`） |
| `chain` 未來日 | **維持** `409` `future_chain_id`（誤寫 memory-chain 仍擋） |

## Extract／report

1. 相對日（「下個月」「下週五」）在 extract **當下**依 Asia/Taipei 收成 `anchor_*`；report 註明推算。
2. 近程可錨定 → emit `future`；report 區塊改為 **Proposed future-sight**（擬寫入），不再只寫「本版不入庫」。
3. 遠／含糊／年齡帶 → **不** emit `future`；有清楚 node 且內容夠當認知 → 既有 `semantic`（`what` 僅已較確定時）；否則當日 `chain`／普通事件敘述。**本版不開 `when.md`。**
4. 無錨無 node → 當日普通事件（0.3 不變）。

## 非目標（本檔）

- Moving window mindzone → [backlog](../../backlog/near-future-mindzone.md)
- Recall 注入 → [backlog](../../backlog/recall-future-sight.md)
- 日曆 sync、提醒、待辦
