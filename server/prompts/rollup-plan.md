# Rollup planner — {{LEVEL}}

Decide whether to roll up memory-chain **{{LEVEL}}** summaries for this dream.

Read JSON context at: `{{CONTEXT_PATH}}`

## Deliverable (STRICT)

- Write the plan as a **JSON object** to this file and nowhere else: `{{RESULT_PATH}}`
- Do **not** print the JSON to stdout. The deliverable is the file at `{{RESULT_PATH}}`.
- The file must contain **only** the JSON object (no markdown fences, no prose before／after).

## Rules

- You may only target ids listed in `candidates` / `candidate_meta`.
- Do **not** invent distant ids.
- `operation` must match each target's `suggested_operation` from context.
- **Server hard rule:** open current periods (`is_current_period: true`) are never written. Candidates should already exclude them; never suggest init／revise for an open week／month／year.
- Prefer **execute: true** for closed past periods that are missing a summary (catch-up) or need revise after backfill.
- Prefer **execute: false** only when there is nothing useful among closed candidates (server may still force catch-up inits).
- Timeline: today=`{{TODAY}}` now=`{{NOW}}` tz=`{{TIMEZONE}}` lang=`{{MEMORY_LANGUAGE}}` run=`{{DREAM_RUN_ID}}`
- Write any human-readable `reason` strings in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = 繁體中文書面語; `zh-Hans` = 简体中文书面语; `en` = English).

## Schema

```json
{
  "level": "{{LEVEL}}",
  "execute": true,
  "targets": [
    { "id": "<id>", "operation": "init|revise", "reason": "short" }
  ]
}
```

When skipping:

```json
{ "level": "{{LEVEL}}", "execute": false, "targets": [], "reason": "short" }
```
