# 0.9.0 HOW

## Question shape

`engram-clarify-generate` reads the days and nodes this distill just wrote, plus existing `clarify/asking/` and `clarify/pending/` titles, so it does not repeat an open question. It also treats a gap already present in chain, a node, or `clarify/history/` as closed.

Each new file asks one fact. Context may be a clause before the question. A second who / when / whether / number / decision is a second file, or it is not asked.

File shape is unchanged: `clarify/asking/{id}.md`, frontmatter `id` and `ts`, body is the question. No answer in the asking file.

## Quota

| New asking files this session | Job |
|-------------------------------|-----|
| 0, assistant reply non-empty | `completed`. `output.clarify_skip_reason` is that reply, trimmed. |
| 1–5 | `completed`. Do not set `clarify_skip_reason`. |
| More than 5 | `failed`. The program does not delete the extras. |
| 0, reply empty or whitespace | `failed`. |

The count is files created during Session B (asking count after minus asking count before). Files already in `asking/` from earlier jobs are not deleted and are not part of the cap.

There is no second generate session. `CLARIFY_GENERATE_MIN` and the retry prompt go away. `CLARIFY_GENERATE_MAX` stays 5.

Session B still runs only after Session A succeeds and the pre-distill work count was greater than zero. A zero work count still skips generate and does not set `clarify_skip_reason`.

The skip sentence is whatever the skill wrote. The program checks that the string is non-empty. It does not parse the sentence or invent a reason.

## Absorb and dismiss

Session A lists `clarify/pending/*.md` before it edits. For each file, the skill either:

- writes the answered fact into the related day and/or node, sets `absorbed_at`, omits `dismissed_because`, moves the file to `clarify/history/`; or
- writes no chain or node prose for that file, sets `dismissed_because` to a short reason, omits `absorbed_at`, moves the file to `clarify/history/`.

A partial answer uses the first path. Only the answered fact is written. The file is still absorbed. This absorb does not open a replacement question. A later clarify-generate may ask the remaining fact as a new one-fact question when that gap is still visible on the chain or the node. It must not copy the old stem.

`dismissed_because` counts only when its value is non-empty after trim. Whitespace does not satisfy the check.

`write` / `edit` cannot delete. After the history file exists, the skill `mv` or `rm`s the pending original. Leaving both copies is not done.

The program's continue prompt lists any id that was in `clarify/pending/` when Session A started and is still under `pending/`, or whose history copy lacks exactly one non-empty `absorbed_at` or `dismissed_because`. After one continue, a remaining gap fails the job and Session B does not run. The program does not score the prose. History files outside that id list are ignored, including files `DELETE /clarify/asking/{id}` moved with `dismissed: true`. That delete path stays as it is.

Aside files (`kind: aside`) use the same two endings. An aside that states a fact is absorbed. An aside with nothing to write is dismissed.

## Job field

`output` on a successful distill job may include:

```json
{ "text": "…", "missing_days": [], "clarify_skip_reason": "No askable gap in this distill." }
```

`clarify_skip_reason` is omitted when Session B wrote 1–5 questions or when Session B did not run. `missing_days` behavior from 0.8.0 is unchanged. Clarify-generate still does not read `jobs/` and does not ask about days that have no diary.

## Future-sight rewrite

Item yaml gains `kind`. Render and parse round-trip it. Missing `kind` is `dated` when the two dates are equal, otherwise `intent`.

`engram-distill` rewrites every item whose `anchor_end` is before the prompt's local today:

| Ending | Zone file | Sentence |
|--------|-----------|----------|
| Happened (`dated` only, and only with evidence) | Item removed | One sentence on the day it landed. Create that day file if needed. |
| Rescheduled, or intent renewed | Item stays, `anchor_end` on or after today, `kind` set | One sentence in the item. Intent text asks whether to continue. It does not say the aim is done or failed. |
| Dropped | Item removed | One sentence on today's day file. Create that file if needed. |

No `## Closed` block is added to the zone. Phone, room, and street text from the item are not copied into Standing facts unless a user event already contains them.

The program starts Session A when the pool and clarify pending are empty if any item is already past `anchor_end`. After the session, such an item is a gap. One continue, then the job fails and Session B does not run. Session B's own gate is unchanged: pool lines plus clarify files before the run.

`GET /future-sight` reads and returns anchors, including expired ones. It does not rewrite the files and does not append a pending event. `swept_expired` is the list of ids with `anchor_end` before today.

## Node sidecars

`package.json` script `nodes:sidecars` runs `scripts/node-sidecars.ts`.

```text
bun run nodes:sidecars -- --store <dir>
bun run nodes:sidecars -- --store <dir> --yes
```

Dry-run prints relative paths and writes nothing. `--yes` may update a node markdown frontmatter and delete `score.yaml` or a mapping `node.meta.yaml`.

`--store` is the store root. Only `<dir>/memories/nodes/` is walked.

Score merge reads an integer `score` first, otherwise an integer `activity_score`, and writes frontmatter `activity_score` clamped to 0–100. Skip the write when frontmatter already has an integer in that range. `--yes` deletes `score.yaml` only after that write, or when the markdown already had a legal score. A missing `{id}.md`, or a sidecar with no integer, is listed and kept. A non-mapping `node.meta.yaml` is reported and kept. An empty node directory is left as it is. Stdout may name paths. It must not print file bodies.
