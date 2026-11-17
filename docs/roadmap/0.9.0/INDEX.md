# 0.9.0 — Clarify facts, future-sight rewrite, node sidecars

← [GUIDELINES](../GUIDELINES.md) · previous: [0.8.0](../0.8.0/INDEX.md) (`shipped`) · [changelog](../../../changelog.md) · [version](../../../version.md) · HOW: [docs/how.md](./docs/how.md) · WHY: [docs/reasoning.md](./docs/reasoning.md)

**Status:** `shipped` (2026-11-17)

> **Product sentence:** Each clarify question asks for one fact, and the next distill absorbs or dismisses every answer. A future-sight item past `anchor_end` is rewritten in the zone file on the next distill: it happened, it moved, or it was dropped, and a readable sentence remains. Node `score.yaml` and `node.meta.yaml` are removed by a dry-run script that copies a missing score into frontmatter and does not keep meta keys.

> **Decisions still open before start: none.**

## Decided

| # | Topic | Decision |
|---|--------|----------|
| 1 | One fact | `engram-clarify-generate` writes one file per question. The stem may name known context. The question itself asks for exactly one fact that can land in one day or one node: who, when, whether, one number, or one decision. Do not put a second independent fact in the same question. |
| 2 | Ceiling, not floor | When this run has an askable gap, write 1 to 5 new asking files. Five is the maximum. Zero is allowed. Do not invent filler so the count reaches three. Do not ask the same gap again after the person already answered it (that answer is now in chain, a node, or `clarify/history/`). |
| 3 | Skip when nothing to ask | If this run has no new event gap and no unresolved node contradiction, write **no** asking files. The skill reply is one sentence saying why. The program copies that sentence into the distill job `output.clarify_skip_reason`. The program does not decide which gaps exist. |
| 4 | When Session B runs | Unchanged mechanical gate: if pool lines plus `clarify/pending/` files are zero **before** distill, skip clarify-generate and do not set `clarify_skip_reason`. If that count was greater than zero and Session A succeeds, always open Session B, even when the skill then writes zero questions. |
| 5 | No minimum retry | Remove the retry that fires when asking files are fewer than three, and remove the failure that demands at least three. New asking files this session: 0 with a non-empty skip sentence succeeds; 1–5 succeeds; more than 5 fails the job. Count **new** files (after minus before), not the whole mailbox. Do not delete older asking files to satisfy the cap. |
| 6 | Pending must leave | The check applies only to ids that were in `clarify/pending/` when Session A started. The job fails while one of those files is still in `pending/`, or while its `history/` copy does not have exactly one of `absorbed_at` and `dismissed_because`. A value that is missing or only whitespace does not count as present. Other history files, including ones moved by `DELETE /clarify/asking/{id}` with `dismissed: true`, are not part of this check. The program does not read the prose to decide whether the fact was written well. |
| 7 | Absorb | For an answer or aside that yields a fact: write that fact into the related day and/or node, set `absorbed_at` (RFC3339, workspace timezone), and move the file to `clarify/history/`. Do not copy the clarify file into `pool/pending.jsonl`. |
| 8 | Partial answer | If the answer only covers part of the question, write the fact that was answered. Do not invent the rest. Still set `absorbed_at` and move the file. During this absorb, do not open a new asking file for the unanswered clause. A later clarify-generate may ask that remaining fact as its own one-fact question when the gap is still visible on the chain or the node. That later question must not copy the old stem to collect the missing clause. |
| 9 | Dismiss | If the answer cannot be written as a fact (empty of content, explicit refusal, or not a fact), do not invent chain or node prose. Set frontmatter `dismissed_because` to a short mechanical reason, do not set `absorbed_at`, and move the file to `clarify/history/`. |
| 10 | Contract docs | Update `docs/data-spec.md`, `docs/architecture/orchestration.md`, and `AGENTS.md` so they no longer require 3–5 questions or a retry until three. In `docs/data-spec.md`, history from distill uses `absorbed_at` or `dismissed_because`. History from `DELETE /clarify/asking/{id}` stays `dismissed: true` only. Do not change that HTTP handler. `docs/api.md` documents `output.clarify_skip_reason` (string, present only when Session B created zero asking files). |
| 11 | Future-sight kind | Each item's yaml fence has `kind: dated` or `kind: intent`. `dated` is a commitment that had to fall on that window. `intent` is an open aim; the end of the window means "confirm whether to continue", not done and not failed. An item with no `kind` is treated as `dated` when `anchor_start` equals `anchor_end`, otherwise as `intent`. The skill writes `kind` when it rewrites the item. Parse and render keep `kind`. |
| 12 | Expired items | On Session A, every item with `anchor_end` before local today is rewritten. `dated` ends as one of: happened (one sentence on the day it landed, then delete the item), rescheduled (`anchor_end` on or after today, one sentence in the item), or dropped (one sentence on today's day file, then delete the item). No evidence of it happening means the skill must not choose happened. `intent` is never marked done or failed only because the window ended; the skill either rewrites it into a renewal question with `anchor_end` on or after today, or drops it when an event already dropped it. Do not leave a `## Closed` section in the zone file. |
| 13 | Where the sentence goes | The readable sentence for a removed item is written into a day file (today's file for a drop; the landing day for happened). Create that day file if this run needs the sentence and the file is absent. Do not copy phone numbers, room numbers, or street addresses from the zone item into a node's Standing facts unless the same words already appear in a user event. |
| 14 | Distill still runs | If pool lines and `clarify/pending/` are both zero, but either zone file has an item with `anchor_end` before local today, Session A still runs. That date compare is the only future-sight decision in the program. Session B still runs only when the pre-run pool plus clarify count was greater than zero. A future-sight-only run does not set `clarify_skip_reason`. |
| 15 | Expired means incomplete | After Session A, any item still in either zone with `anchor_end` before local today is a distill gap (one continue, then fail). The program does not read the sentence and does not decide happened versus dropped. `GET /future-sight` no longer deletes expired items and no longer appends a mechanical pending line. `swept_expired` lists ids that are still in the files and past `anchor_end`. |
| 16 | Node sidecars | `bun run nodes:sidecars -- --store <dir>` is a separate script from `import:engram`. `<dir>` is the store root; the script only walks `<dir>/memories/nodes/`. Default is dry-run and writes nothing. The frontmatter key written is `activity_score`. If both `score` and `activity_score` in the sidecar are integers, use `score`, then clamp to 0–100. `--yes` deletes `score.yaml` only when this run wrote that integer into `{id}.md`, or when `{id}.md` already had a legal 0–100 `activity_score`. If `{id}.md` is missing, or the sidecar has no integer `score` or `activity_score`, dry-run lists the relative path and `--yes` leaves the file. |
| 17 | node.meta.yaml | Lite keeps no key from `node.meta.yaml`. A YAML mapping is residual: dry-run lists the path; `--yes` deletes the file. A file that is not a YAML mapping (scalar, list, or parse error) is listed and left in place under both dry-run and `--yes`. Do not invent a node settings format. Do not write file bodies into the repo, tests, or logs beyond the relative path. Distill does not update `activity_score`. |

## Out of scope

- A TypeScript table that classifies what to ask or whether an answer is “enough”
- Keeping “at least 3 questions” as a product rule
- Ask reading `clarify/`
- Using clarify questions to fill calendar days that have no diary (shipped in 0.8.0: those days are only `output.missing_days`)
- Changing submit, delete, or aside HTTP shapes
- Merging or deleting nodes from a clarify answer
- A server rule for whether a future-sight item happened, other than `anchor_end` before today
- Keeping expired items only as a GET flag while the zone file stays unchanged
- Distill or the server computing a new `activity_score`
- Redefining what the activity score means
- Editing chain or clarify files in order to delete sidecars

## Acceptance

- [x] `engram-clarify-generate` states: one fact per question; 0–5 with 5 as the ceiling; skip with one reason sentence when there is no gap; do not re-ask a gap already answered
- [x] `engram-distill` states: every pending file is absorbed (`absorbed_at`) or dismissed (`dismissed_because`) and moved to `history/`; a partial answer writes only the answered fact and is still absorbed; do not invent the unanswered part
- [x] `docs/data-spec.md` and `docs/architecture/orchestration.md` no longer require a minimum of three questions or a generate retry
- [x] `docs/api.md` documents `output.clarify_skip_reason`
- [x] `AGENTS.md` describes clarify-generate as 0–5, not a mandatory 3–5
- [x] Unit tests on an isolated temp store, applied only to ids that were in `clarify/pending/` before Session A: still in `pending/` is a gap; the history copy with only a non-empty `absorbed_at` is not; only a non-empty `dismissed_because` is not; both, neither, or a whitespace-only value is a gap. A history file that was not in that pre-run set, including one with only `dismissed: true`, is not a gap. The generate prompt and skill text do not require a minimum of three
- [x] `bun test` passes
- [x] Tests and demo data contain no real personal memory
- [x] `engram-distill` states the dated and intent endings, the no-evidence rule, and that contact details are not copied into Standing facts
- [x] `docs/data-spec.md` documents `kind`, and `docs/api.md` documents that GET lists expired ids without removing them
- [x] Unit tests on an isolated temp store: an expired item still in the zone is a distill gap; an item with `anchor_end` on or after today is not; GET does not append a pending line
- [x] `bun run nodes:sidecars` dry-run writes nothing. With `--yes`, a score sidecar fills a missing frontmatter score and is deleted; a different sidecar score does not replace a legal frontmatter score; a mapping `node.meta.yaml` is deleted; a non-mapping meta file is left; an empty node directory is unchanged. Fixtures are fictional and not a real vault.

## Tracks

| Order | Work |
|-------|------|
| 1 | Contracts: `docs/data-spec.md`, `docs/api.md`, `docs/architecture/orchestration.md`, `AGENTS.md`, `engram-clarify-generate`, `engram-distill`. Skill-text tests. |
| 2 | Distill file check: history copy has exactly one of `absorbed_at` or `dismissed_because`. Unit tests. |
| 3 | Session B: drop the minimum and the retry; cap new files at 5; on zero new files, require a non-empty assistant reply and store it as `output.clarify_skip_reason`. Unit tests around the prompt and the count rule (no live model). Done. |
| 4 | Future-sight: skill text, `kind` round-trip, GET no longer sweeps, Session A runs for expired items, distill gap on `anchor_end` before today. Unit tests. No live model. |
| 5 | `nodes:sidecars` script and fixture tests. |

## Anchor files

`.agents/skills/engram-clarify-generate/SKILL.md`, `.agents/skills/engram-distill/SKILL.md`, `server/worker/pi.ts`, `server/worker/distill-gate.ts`, `server/future-sight/index.ts`, `server/jobs/index.ts`, `scripts/node-sidecars.ts`, `docs/data-spec.md`, `docs/api.md`, `docs/architecture/orchestration.md`, `AGENTS.md`

## Document map

| File | Role |
|------|------|
| INDEX.md | WHAT |
| docs/how.md | HOW clarify, future-sight rewrite, and the sidecar script land |
| docs/reasoning.md | WHY the floor of three is removed, why GET no longer expires items, and why meta keys are not kept |
| HANDOFF.md | Start order and bans |
