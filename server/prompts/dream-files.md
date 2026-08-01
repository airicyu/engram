# Engram dream (file pipeline)

You are consolidating short-term memory into long-term store files for dream run `{{DREAM_RUN_ID}}`.

## Paths (absolute)

- Store root: `{{STORE_DIR}}`
- Draft workspace (ONLY place you may write memory files): `{{DRAFT_DIR}}`
- Report file (you must write): `{{REPORT_PATH}}`
- Frozen context JSON (read-only): `{{CONTEXT_PATH}}`

Timezone: `{{TIMEZONE}}` · Memory language: `{{MEMORY_LANGUAGE}}` · today=`{{TODAY}}` · now=`{{NOW}}`

## Rules

1. **Do not** edit live `{{STORE_DIR}}/memories/**` directly. Only edit under `{{DRAFT_DIR}}/memories/**`.
2. Prefer **copy** live → draft (shell/`cp`) then edit the draft copy. Do **not** paste huge files into chat as the write mechanism.
3. **file_update**: rewrite whole narrative files (`*.summary.md`, `nodes/*/understand/what.md`, **`memories/future-sight/hot.md`** and **`later.md`** only — never `active/{id}.md`, new node files). Whole file = latest narrative — **no** `## Current` / `## History`.
   - Future-sight: two zone files. Each item is `## {id}` + yaml fence with **only** `anchor_start`／`anchor_end` + short body. Sort near→far (`anchor_start`, then `anchor_end`, then `id`). Do **not** write `node_refs`／`event_refs`／`dream_run_id`／`committed_at` into items.
   - **Must** read live／draft `hot.md`／`later.md` and propose add／update／delete when this round’s events affect near-horizon anchors. Unrelated mentions → leave files alone.
   - Do **not** add anchors with `anchor_start` later than today+`future_sight_window_days` (default 365). Prefer hot vs later by `future_sight_hot_days` (default 30) from today.
4. **file_append (ledger only)**: day ledgers `memories/chain/days/{YYYY-MM}/{YYYY-MM-DD}.md` (month folder = calendar month of the day id; **not** arbitrary subpaths). Exclude `*.summary.md`. Write the new block into `{{DRAFT_DIR}}/appends/<same relative path>` (server will append). Block must include `<!-- patch:… -->` and `### patch:… · events:[…]`. Do **not** overwrite the whole ledger with file_update.
5. **deletes**: optional lines in `{{DRAFT_DIR}}/deletes.txt` (paths relative to store root, under `memories/` only).
6. Week／month／year summaries: if this round needs rollup updates, write them as file_update under the same draft (same human review).
7. Write language = `{{MEMORY_LANGUAGE}}`. Calendar days follow today=`{{TODAY}}` (never invent future day chain ids).
8. **Node score involvements** (required artifact, even if empty): write `{{DRAFT_DIR}}/node-score-involvements.yaml` with:
   ```yaml
   nodes:
     - id: <existing_node_id>
       category: mention   # or update | focus
       reason: "short note"  # optional
   ```
   - Only list nodes that **already existed before this dream** and were involved this round. **Omit** nodes created in this draft.
   - Categories (only these three): `mention` (passed over)｜`update` (substantive what.md change)｜`focus` (main subject of this round).
   - Do **not** write any numeric score／`max_score`／`need_downscale`. Server computes scores on approve.
   - Empty list is fine: `nodes: []`.

## Report (`{{REPORT_PATH}}`)

Write markdown with **exactly** these section headings (fill narrative; Scope／Events／Appendix may be stubbed — server rewrites them). You may omit `## Node score involvements` — the server generates it from the artifact:

```markdown
# Dream report — {{DREAM_RUN_ID}}

## Scope
## Events covered
## Narrative
### Timeline
### Long-term updates
### Near future
### Uncertainties
## Appendix — pending deploy
### Paths
```

In **Near future**, explain add／update／delete on `memories/future-sight/hot.md` and／or `later.md` (or `_None_`).  
Empty narrative subsections must say `_None_`. Do **not** embed full unified diffs. Appendix Paths should list the two future-sight zone paths when touched.

## Done

When files + report are written, exit. Do not print typed JSON patches. Stdout may be empty or a short status line.
