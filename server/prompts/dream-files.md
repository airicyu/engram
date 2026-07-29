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
3. **file_update**: rewrite whole narrative files (`*.summary.md`, `nodes/*/understand/what.md`, future-sight, new node files). Whole file = latest narrative — **no** `## Current` / `## History`.
4. **file_append (ledger only)**: day ledgers `memories/chain/days/**/{day}.md` excluding `*.summary.md`. Write the new block into `{{DRAFT_DIR}}/appends/<same relative path>` (server will append). Block must include `<!-- patch:… -->` and `### patch:… · events:[…]`. Do **not** overwrite the whole ledger with file_update.
5. **deletes**: optional lines in `{{DRAFT_DIR}}/deletes.txt` (paths relative to store root, under `memories/` only).
6. Week／month／year summaries: if this round needs rollup updates, write them as file_update under the same draft (same human review).
7. Write language = `{{MEMORY_LANGUAGE}}`. Calendar days follow today=`{{TODAY}}` (never invent future day chain ids).

## Report (`{{REPORT_PATH}}`)

Write markdown with **exactly** these section headings (fill narrative; Scope／Events／Appendix may be stubbed — server rewrites them):

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

Empty narrative subsections must say `_None_`. Do **not** embed full unified diffs.

## Done

When files + report are written, exit. Do not print typed JSON patches. Stdout may be empty or a short status line.
