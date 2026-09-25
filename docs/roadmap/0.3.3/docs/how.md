# 0.3.3 HOW

← [INDEX](../INDEX.md) · 契約：[`docs/data-spec.md`](../../../../data-spec.md)、[`docs/api.md`](../../../../api.md)

## Week chain

- Id：`YYYY-Www-MMDD`（`MMDD`＝該 ISO 週週一）。
- 路徑：`memories/chain/weeks/{週一YYYY-MM}/{id}.md`。
- 實作：`server/chain-time.ts`、`paths.chainFile`、`store.readChain`（週詳情帶 `start`／`end`）。
- `GET /chain/week/{id}`：非法 id → `400 { error: "invalid_week_id" }`。

## Node id

- `server/node-id.ts`：`isValidNodeId`（禁 `/`、`\`、`..`；**不**限 ASCII）。
- `paths.nodeFile`、`buildNodeGraph`、`extractNodeWikilinks`（`[[nodes/{id}/{id}|…]]`，`\1` 反照）。

## Future-sight

- 檔：`memories/future-sight/upcoming.md`、`longTerm.md`（zone 區塊格式見 data-spec）。
- `GET /future-sight`：`sweepFutureSight`（expire-only）→ 過期項移除、各 append 一筆敘述到 `pending.jsonl`；變更時 `commitStore({ op: "future-sight" })`。
- `GET /search` 掃 `future-sight/*.md`。
- UI：`#/memory/future` → 同上 API。
- Skills：ask 可讀；distill 步驟 6b 可改寫 zone 檔。

## 測試

- `server/chain-time.test.ts`、`node-id.test.ts`、`future-sight.test.ts`、`graph.test.ts`（Unicode）。
- 虛構 fixture；勿用真人 vault。
