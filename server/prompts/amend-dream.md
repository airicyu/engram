# Engram amend-dream (same pending draft)

You are applying a **minimal** human correction to an **already pending** dream draft for run `{{DREAM_RUN_ID}}`.

This is **not** a full re-extract. Do **not** rebuild the dream from scratch. Change only what the instruction requires.

## Human instruction (authoritative)

{{INSTRUCTION}}

## Paths (absolute)

- Store root: `{{STORE_DIR}}` (Read only for live memories — never Write／Edit live)
- Draft workspace (ONLY place you may write memory files): `{{DRAFT_DIR}}`
- Existing report (update in place; keep required headings): `{{REPORT_PATH}}`
- Amend context JSON (read-only): `{{CONTEXT_PATH}}`
- Writable roots (enforced by tools):
  - {{WRITABLE_ROOTS}}

Timezone: `{{TIMEZONE}}` · Memory language: `{{MEMORY_LANGUAGE}}` · today=`{{TODAY}}` · now=`{{NOW}}`

Frozen scope event ids (do **not** expand／rescan short-term): see context `scope`.

Draft orientation (paths already in this pending draft): {{DRAFT_SUMMARY}}

## Rules

1. **Do not** edit live `{{STORE_DIR}}/memories/**`. Only edit under `{{DRAFT_DIR}}/memories/**` (and draft sidecars under `{{DRAFT_DIR}}`).
2. Prefer **Read** existing draft／report／live, then **Edit** the smallest set of files. Do **not** use Bash／shell to rewrite store files.
3. Keep standing understanding rules for any `nodes/*/understand/what.md` you touch: four English `##` headings in order — Identity → Relation → Standing facts → Current situation; empty body = `_None_`; no day-diary backbone in `what.md`.
4. Ledger appends still use `{{DRAFT_DIR}}/appends/memories/chain/days/...` when needed; do **not** wholesale overwrite day ledgers with file_update.
5. You may update `{{DRAFT_DIR}}/node-score-involvements.yaml` if the instruction requires it; categories only `mention`｜`update`｜`focus`. Prefer leaving involvements alone when the human only asked for prose／path fixes (category-only fixes belong to structured UI, not this job).
6. Write language = `{{MEMORY_LANGUAGE}}`. Do **not** invent future day chain ids after today=`{{TODAY}}`.
7. **Do not** create a brand-new dream from events; ignore the urge to re-cover the whole scope unless the instruction explicitly asks.

## Report (`{{REPORT_PATH}}`)

The report **already exists**. Update Narrative subsections that your file edits make stale. Keep these headings present:

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

You may leave Scope／Events／Appendix stubbed — the server rewrites them. You may omit rewriting `## Node score involvements` — the server regenerates it.  
Empty narrative subsections must say `_None_`.

## Done

When the minimal edits + report update are done, exit. Do not print typed JSON patches.
