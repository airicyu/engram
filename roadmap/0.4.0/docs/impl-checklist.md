# 0.4.0 — 實作清單（草案）

← [INDEX](../INDEX.md)

同意做法文件後，建議順序：

1. **Store** — `future-sight/active/`；home ensure；讀寫／sweep（L0+L1 event → 硬刪）
2. **Schema** — `future` patch；materialize + manifest；`commitDraft`
3. **Approve** — `stale_future_anchor`；維持 `future_chain_id`；approve 後可選 sweep
4. **Extract prompt + report** — 近程 → `future`；遠景分流；Proposed future-sight
5. **API** — 僅 `GET /future-sight`；`/status` 可選 count
6. **Docs／skill／changelog／version** — `api-docs`、workbench skill、`version.md` → `0.4.0`
7. **不做** — `GET /future-sight/expired`、`expired.jsonl`、Recall 注入、mindzone、`when.md`、過期 cron

測試：`future` → approve → list；植入過期 anchor → GET sweep → active 無檔、L0 有 `system/future_sight_expired`、L1 有對應 note。
