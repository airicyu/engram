# Activation（激活檢索）

← [INDEX](../INDEX.md)

給定 query（或無 query 的「此刻狀態」），組 **activation packet**，有 token budget：

```
1. short-term-memory/ 全部（尚未被 clear 時）
2. memory chain：當日 days/（MVP）；後期再加本週 weeks/、視需要 months/
3. query 相關 top-K nodes：INDEX + understand（Current）+ chronology/recent
4. 沿 links 擴展 1 hop（高 strength 優先 — favor routing；後期）
5. 必要時 tool：search events / read node / 讀 L0 / 讀 L1.5 patches
```

衝突時：**L1 優先於 L2**（更新鮮）。  
Understand 只讀各 facet 的 **Current** 段（見 [nodes.md](./nodes.md)）。

## 誠實狀態（已定案）

Packet 必須標來源與整合狀態，避免「以為忘了」：

| 欄位 | 說明 |
|------|------|
| `sources` | `L1` \| `L2` \| `chain` \| `gap` |
| `dream_status` | `ok` \| `dead_letter_pending` \| `dream_incomplete` \| `never_dreamed` |

- L1 已空、pending DLQ 非空 → **`dead_letter_pending`**（查 `dream/dead-letter.jsonl`；恢復見 [dream.md](./dream.md#dlq-review已定案)）
- extract 失敗、L1 仍在 → **`dream_incomplete`**
- 從未成功 dream → `never_dreamed`
- `gap` = budget 截斷或檢索未命中（與「沒發生過」區分）

## 漸進

| Phase | 做法 |
|-------|------|
| P0 / MVP | 關鍵字 + node_refs +（可選）1-hop；接受常漏上下文 |
| 後期 | embedding 語意檢索；week/month chain |

## 熱門節點 chronology 預算

見 [nodes-chronology.md](./nodes-chronology.md)。
