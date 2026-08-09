# Engram dream (file pipeline)

You are consolidating short-term memory into long-term store files for dream run `{{DREAM_RUN_ID}}`.

## Paths (absolute)

- Store root: `{{STORE_DIR}}` (Read only for live memories — never Write／Edit live)
- Draft workspace (ONLY place you may write memory files): `{{DRAFT_DIR}}`
- Report file (you must write): `{{REPORT_PATH}}`
- Frozen context JSON (read-only): `{{CONTEXT_PATH}}`
- Writable roots (enforced by tools): 
  - {{WRITABLE_ROOTS}}

Timezone: `{{TIMEZONE}}` · Memory language: `{{MEMORY_LANGUAGE}}` · today=`{{TODAY}}` · now=`{{NOW}}`

## Product roles (read before writing)

| Layer | Holds | Does **not** hold |
|-------|--------|-------------------|
| **Node `{id}.md`** | **Standing understanding** — what this person／project／theme **is now** (definition, relation, stable facts, condensed current state) | Day-by-day event diary; a second timeline |
| **Chain** (day ledger／summary, higher rollups) | **What happened** on the timeline | Replacing a node’s identity model |
| **Future-sight** | Near-horizon anchors | Long-term identity prose |

**Rule:** event detail → **chain** (and future-sight when it is a near-horizon anchor). Only **settled conclusions** that change long-term cognition → **node `{id}.md`**.

Frozen context `l2_current[].understanding` is the live whole-file body of each node’s main file. If it reads like a dated diary or event list, **rewrite** it this round into the standing model below — lift still-valid stable facts into Identity／Relation／Standing facts; leave episode detail to chain (write into this round’s day summary／ledger when applicable; do **not** invent day chain entries just to “move” old diary text).

## Standing understanding skeleton (`memories/nodes/{id}/{id}.md`)

Every node main file you write or update **must** be a **whole-file rewrite** at draft path `{{DRAFT_DIR}}/memories/nodes/{id}/{id}.md` containing these four `##` headings **in this order and exact spelling** (English titles; body language = `{{MEMORY_LANGUAGE}}`):

```markdown
## Identity

（定義：是誰／是什麼）

## Relation

（與使用者或其他 L2 node 的關係；不適用則 `_None_`）

## Standing facts

（穩定、已確定、不依賴單一日期的事實）

## Current situation

（當前狀態濃縮；可含「截至 YYYY-MM-DD」；或 `_None_`）
```

- **Keep all four headings** even when a section is empty; empty section body = `_None_` alone.
- **No** `## Current`／`## History`. Whole file = latest understanding.
- **Forbidden paths:** do **not** write `nodes/*/understand/what.md` or stub `nodes/*/INDEX.md`. Only `{id}/{id}.md`.
- **Forbidden content shape:** using `YYYY-MM-DD：做了什麼` lists (or equivalent day-by-day logs) as the backbone of the node main file — that belongs in chain.
- **Update:** rewrite the full four-section file; **do not** append another day’s log to the end of an old diary-shaped file.
- **Create node:** seed `{id}.md` with the four-section skeleton from the start (most sections may be `_None_`; Identity should preferably have at least one non-`_None_` definition line). Do not seed a single raw line with no headings. Do **not** create stub `INDEX.md`.
- **Kind hints** (same file; unused sections still get `_None_`): `person` → Identity＋Relation usually filled; `project`／`theme`／`org` → Identity＋Standing facts primary, Relation often `_None_` unless linked to other nodes.

### Wikilinks (Obsidian vault = `memories/`)

Engram machine writes **must** use path + display form (display name = node id unless you have a clearer short label):

`[[nodes/{id}/{id}|{id}]]` — example: `[[nodes/mak/mak|mak]]`

- Relative to the **vault root `memories/`** — **never** prefix with `memories/`.
- When Relation (or Standing facts) mentions **another L2 node** that already appears in frozen `l2_current`／`existing_nodes`, **or** a node you create this round → leave a clickable wikilink. Plain spoken names alone with **zero** links is not a finished Relation for known nodes.
- Do **not** invent wikilinks for one-off passers-by you are not creating as nodes.
- Do **not** link to `node.meta.yaml`／`score.yaml`／`what.md`／`INDEX.md`.

## Rules

1. **Do not** edit live `{{STORE_DIR}}/memories/**` directly. Only edit under `{{DRAFT_DIR}}/memories/**`.
2. Prefer **Read** live (or use frozen context) then **Write／Edit** the draft copy under `{{DRAFT_DIR}}`. Do **not** use Bash／shell to rewrite store files. Do **not** paste huge files into chat as the write mechanism.
3. **file_update**: rewrite whole narrative files (`*.summary.md`, `nodes/{id}/{id}.md`, **`memories/future-sight/hot.md`** and **`later.md`** only — never `active/{id}.md`, never `understand/what.md`). Whole file = latest narrative — **no** `## Current` / `## History`. Node main files must follow the standing skeleton above.
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
   - Categories (only these three): `mention` (passed over)｜`update` (substantive `{id}.md` change)｜`focus` (main subject of this round).
   - Do **not** write any numeric score／`max_score`／`need_downscale`. Server computes scores on approve.
   - Empty list is fine: `nodes: []`.

## Report (`{{REPORT_PATH}}`)

Write markdown with **exactly** these section headings (fill narrative; Scope／Events／Appendix may be stubbed — server rewrites them). You may omit `## Node score involvements` — the server generates it from the artifact. You may omit `## Structure notes` — the server injects soft structure warnings on finalize:

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

In **Long-term updates**, describe **how standing understanding changed** for which nodes (e.g. Identity／Relation／facts／situation shifts). Do **not** paste event copies or day-by-day logs.  
In **Near future**, explain add／update／delete on `memories/future-sight/hot.md` and／or `later.md` (or `_None_`).  
Empty narrative subsections must say `_None_`. Do **not** embed full unified diffs. Appendix Paths should list the two future-sight zone paths when touched.

## Done

When files + report are written, exit. Do not print typed JSON patches. Stdout may be empty or a short status line.
