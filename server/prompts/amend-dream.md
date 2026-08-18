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
3. Keep standing understanding rules for any `memories/nodes/{id}/{id}.md` you touch: four English `##` headings in order — Identity → Relation → Standing facts → Current situation; empty body = `_None_`; no day-diary backbone. **Forbidden:** write `understand/what.md` or stub `INDEX.md`.
4. When Relation／Standing facts mention another known／this-round L2 node, keep a vault-relative wikilink `[[nodes/{id}/{id}|{id}]]` (vault = `memories/`; no `memories/` prefix).
5. If the instruction leads you to edit **chain** prose:
   - **Ledger** blocks stay fragmentary (do not article-ize them unless the human asked).
   - **Day summary:** different life threads → different `##`; unrelated beats → separate paragraphs; no combined-title walls. Day may stay fragmentary.
   - **Week／month／year summary:** retrospective with **selection**. Answer that layer’s question (week = what mattered; month = rhythm／turns; year = through-line). **Do not** paste lower summaries as an anthology. Omit lower beats that do not define the period. Do **not** add omitted lower detail back “for completeness” unless the human instruction explicitly asks to restore a fact.
   - Wikilinks: first mention of a known／this-round L2 node **in that `##` section** → P1 `[[nodes/{id}/{id}|{id}]]`; later in the same section a spoken name is enough. If a beat is omitted, omit its links too. Do **not** expand edits to unrelated historical days just to add links (non-backfill).
6. Ledger appends still use `{{DRAFT_DIR}}/appends/memories/chain/days/...` when needed; do **not** wholesale overwrite day ledgers with file_update.
7. You may update `{{DRAFT_DIR}}/node-score-involvements.yaml` if the instruction requires it; categories only `mention`｜`update`｜`focus`. Prefer leaving involvements alone when the human only asked for prose／path fixes (category-only fixes belong to structured UI, not this job).
8. Write language = `{{MEMORY_LANGUAGE}}` (`zh-Hant` = 繁體中文書面語). Do **not** invent future day chain ids after today=`{{TODAY}}`.
9. **Do not** create a brand-new dream from events; ignore the urge to re-cover the whole scope unless the instruction explicitly asks.

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

You may leave Scope／Events／Appendix stubbed — the server rewrites them. You may omit rewriting `## Node score involvements`／`## Structure notes` — the server regenerates them on finalize.  
Empty narrative subsections must say `_None_`.

## Done

When the minimal edits + report update are done, exit. Do not print typed JSON patches.
