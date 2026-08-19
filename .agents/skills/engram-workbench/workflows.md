# Engram workbench workflows

## Capture with attachments (0.29+)

1. `POST /attachments/uploads` — multipart `file` → `201` `{ path, day, filename }` (tmp)
2. Build `raw` with exact `![[{path}]]` embed at cursor position (no `|alias`)
3. `POST /activities` — `{ raw, attachments: [{ path, relationship }] }` (relationship required)
4. Server moves tmp→formal, appends `## Attachment relationships` appendix to stored `raw`
5. Compose cancel before submit: `DELETE /attachments/uploads/tmp?day=&filename=` (idempotent)

## Capture → Extract → Approve → Memory

1. `GET /status` — confirm server up
2. `POST /activities` with `{ "raw": "…" }` (repeat as needed)
3. `POST /dreams/run` → 202; poll `/status` until `dream_status=ok`（預設 `dream_auto_approve`）or `pending_review`（已關自動 approve）or `dream_job.status=failed`
4. If still pending：`GET /dreams/pending` — read report; check timeline / new nodes
5. If wrong direction → `POST /dreams/retry` with `{ reason }` (same frozen scope), or `POST /dreams/amend` with `{ instruction }` (same `dream_run_id`), or `POST /dreams/discard`, or `POST /dreams/cancel` if still running. Do **not** call `/dreams/run` while pending.
6. If pending and OK → `POST /dreams/approve`（自動 approve 成功時可跳過）
7. `GET /memories/search?q=…` — verify hits（預設含 future-sight）
8. `GET /memories/future-sight` — list active near-horizon anchors (optional)
9. `POST /memories/ask` `{ q }` — natural-language Q&A（always may read hot＋later）

## Empty pool / rollup-only (0.24+)

When short-term is empty:

- Closed week／month／year missing higher summary（lower has content）→ `POST /dreams/run` returns **202** **rollup-only**（skip day extract； cascade only）. Pending `scope: []`.
- No such catch-up → **409** `nothing_to_dream`.
- Pending already → **409** `pending_review`（unchanged）.

Approve／discard／retry／amend paths are the same as a normal dream.

## Clarify (0.30+)

Not activities. Does **not** write L0／short-term／day ledger.

1. `GET /memories/clarify/asking` → `{ items: [...] }`（empty = `{ "items": [] }`）
2. Answer: `POST /memories/clarify/asking/{id}/submit` `{ "answer": "…" }` → moves to pending
3. Dismiss: `DELETE /memories/clarify/asking/{id}`（missing → 200 idempotent）
4. Freestyle: `POST /memories/clarify/aside` `{ "raw": "…" }` → **201** pending aside
5. Dream **lock**（running extract／approve）→ `409 dream_locked`；**`pending_review` may still write** clarify／activities
6. Next dream distill／generate updates draft nodes／asking； approve archives snapshot∩pending → history

## Browse chain／nodes

- Days: `GET /memories/chain` · `GET /memories/chain/{day_id}`
- Higher: `GET /memories/chain/weeks|months|years` · `…/{id}`
- Nodes: `GET /memories/nodes` · `GET /memories/nodes/graph` · `GET /memories/nodes/{id}`（body field `understanding`）

Empty browse → **200** with `present: false`／empty lists（not 404).

## Pending 期間仍可 capture／clarify

New events／clarify enter queues but are **outside** frozen S. Approve clears only S; new items remain for the next dream.

## Review 禁止事項

Do **not** hand-edit short-term／L2／`dreams/` draft／future-sight／clarify to “fix” a pending dream. Only retry／amend／approve／discard.

## Empty patches

Pending with no patches is valid. Approve clears S with **no** L2 write (confirm discarding short-term only). Clarify archive may still run on approve.

## Future chain.id

Approve returns `409 future_chain_id`. Pending stays. Fix via retry with reason (emit `future` instead), or wait／discard.

## Stale future anchor

Approve returns `409 stale_future_anchor` when a `future` patch has `anchor_end` before today. Pending stays. Supersede with fresh anchors.

## Future-sight expiry

`GET /memories/future-sight` expire-only；`POST /dreams/run` 開頭 full maintain（過期／出窗／重桶）並可 `engram: future-sight maintain` commit。Discard **不**回滾該維護 commit。無過期列表 API。Keyword search may include future via `scope=future`（default on）.

## Extract failure

`dream_job.status=failed`, `phase: extract|materialize`. No pending. Short-term unchanged. Retry `/dreams/run`.

## l1_clear_pending

Commit succeeded but clearing S failed. Call approve again — only retries clear. Do not call `/dreams/run` as if still pending. Wire name `l1_*` = short-term memory.

## Memory ask

`POST /memories/ask` `{ q }` → poll `GET /memories/ask/{job_id}` until `completed` | `failed` | `cancelled`. One running ask at a time (`409 ask_busy`). Cancel via `POST /memories/ask/{job_id}/cancel`. Agent may read both `upcoming.md` and `longTerm.md`. Do **not** send `include_later` (`400 include_later_removed`). `/status.ask_job` mirrors the running／last ask job.
