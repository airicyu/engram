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
3. `POST /dreams/run` → 202; poll `/status` until `dream_status=pending_review` (or `dream_job.status=failed`)
4. `GET /dreams/pending` — read report; check timeline / new nodes
5. If wrong direction → `POST /dreams/retry` with `{ reason }` (same frozen scope), or `POST /dreams/amend` with `{ instruction }` (same `dream_run_id`), or `POST /dreams/discard`, or `POST /dreams/cancel` if still running. Do **not** call `/dreams/run` while pending.
6. If OK → `POST /dreams/approve`
7. `GET /memories/search?q=…` — verify hits（預設含 future-sight）
8. `GET /memories/future-sight` — list active near-horizon anchors (optional)
9. `POST /memories/ask` with optional `include_later` — natural-language Q&A

## Pending 期間仍可 capture

New events enter the pool but are **outside** frozen S. Approve clears only S; new events remain for the next dream.

## Review 禁止事項

Do **not** hand-edit L1／L2／draft／future-sight to “fix” a pending dream. Only retry／amend／approve／discard.

## Empty patches

Pending with no patches is valid. Approve clears S with **no** L2 write (confirm discarding short-term only).

## Future chain.id

Approve returns `409 future_chain_id`. Pending stays. Fix via retry with reason (emit `future` instead), or wait／discard.

## Stale future anchor

Approve returns `409 stale_future_anchor` when a `future` patch has `anchor_end` before today. Pending stays. Supersede with fresh anchors.

## Future-sight expiry

`GET /memories/future-sight` expire-only；`POST /dreams/run` 開頭 full maintain（過期／出窗／重桶）並可 `engram: future-sight maintain` commit。Discard **不**回滾該維護 commit。無過期列表 API。

## Extract failure

`dream_job.status=failed`, `phase: extract|materialize`. No pending. L1 unchanged. Retry `/dreams/run`.

## l1_clear_pending

Commit succeeded but clearing S failed. Call approve again — only retries clear. Do not call `/dreams/run` as if still pending.

## Memory ask

`POST /memories/ask` `{ q, include_later? }` → poll `GET /memories/ask/{job_id}` until `completed` | `failed` | `cancelled`. One running ask at a time (`409 ask_busy`). Cancel via `POST /memories/ask/{job_id}/cancel`. Default reads hot future-sight only; set `include_later: true` to allow `later.md`.
