# Rollup planner — {{LEVEL}}

Decide whether to roll up memory-chain **{{LEVEL}}** summaries for this dream.

Read JSON context at: `{{CONTEXT_PATH}}`

## Rules

- Output **JSON only** (no summary prose).
- You may only target ids listed in `candidates` / `candidate_meta`.
- Do **not** invent distant ids.
- `operation` must match each target's `suggested_operation` from context.
- Prefer **execute: false** when every candidate is still the open current period (`is_current_period: true`) and changes are minor.
- Prefer **execute: true** for past periods (especially after backfill / catch-up).
- Timeline: today=`{{TODAY}}` now=`{{NOW}}` tz=`{{TIMEZONE}}` run=`{{DREAM_RUN_ID}}`

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
