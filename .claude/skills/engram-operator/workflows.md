# Engram operator workflows

## Capture → Extract → Approve → Recall

1. `GET /status` — confirm server up
2. `POST /ingest` with `{ "raw": "…" }` (repeat as needed)
3. `POST /dream/run` → 202; poll `/status` until `dream_status=pending_review` (or `dream_job.status=failed`)
4. `GET /dream/pending` — read report; check timeline / new nodes
5. If wrong → `POST /dream/run` again (**supersede**) or `POST /dream/discard`
6. If OK → `POST /dream/approve`
7. `GET /activate?q=…` — verify L2／chain

## Pending 期間仍可 ingest

New events enter the pool but are **outside** frozen S. Approve clears only S; new events remain for the next dream.

## Review 禁止事項

Do **not** hand-edit L1／L2／draft to “fix” a pending dream. Only supersede／approve／discard.

## Empty patches

Pending with no patches is valid. Approve clears S with **no** L2 write (confirm discarding short-term only).

## Future chain.id

Approve returns `409 future_chain_id`. Pending stays. Fix via supersede, or wait／discard.

## Extract failure

`dream_job.status=failed`, `phase: extract|materialize`. No pending. L1 unchanged. Retry `/dream/run`.

## l1_clear_pending

Commit succeeded but clearing S failed. Call approve again — only retries clear. Do not supersede as if still pending.
