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
- Prefer **execute: false** when every candidate is still the open current period (`is_current_period: true`) and changes are minor.
- Prefer **execute: true** for past periods (especially after backfill / catch-up).
- Timeline: today=`{{TODAY}}` now=`{{NOW}}` tz=`{{TIMEZONE}}` lang=`{{MEMORY_LANGUAGE}}` run=`{{DREAM_RUN_ID}}`
- Write any human-readable `reason` strings in **{{MEMORY_LANGUAGE}}** (`zh-Hant`／`zh-Hans`／`en`).

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
