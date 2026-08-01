# Rollup writer — year

Write the **full new summary body** for one **year** memory-chain file.

Read JSON context at: `{{CONTEXT_PATH}}`

- id=`{{ID}}` · operation=`{{OPERATION}}`
- today=`{{TODAY}}` · now=`{{NOW}}` · tz=`{{TIMEZONE}}` · lang=`{{MEMORY_LANGUAGE}}` · run=`{{DREAM_RUN_ID}}`

## Deliverable (STRICT)

- Write the summary markdown to this file and nowhere else: `{{OUTPUT_PATH}}`
  (store-relative: `{{OUTPUT_REL}}`)
- Do **not** print the summary to stdout. The deliverable is that file.
- The file must contain **only** the summary body — **first line must be a `##` title** (no process narration, no fences wrapping the whole file).

Write the summary body in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = Traditional Chinese, `zh-Hans` = Simplified Chinese, `en` = English). On revise, rewrite the full body in that language (do not leave mixed-language prior text).

## Purpose

A **year retrospective** — as if someone reviewed the months and wrote what this year *was* about. High altitude, still personal; scannable by life dimension; each section a through-line with **year-scale time sense**.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early year → mid → late year (or spring→summer→autumn…), with clear time anchors.

This is **not** a month-by-month chronology as the page spine (no top-level Jan→Dec tour). Group by what defined the year; **within** each group, tell the arc in time order.

## How to think (required)

1. Ask: **which life dimensions defined this year?** Only keep dimensions with substance in `lower[]` (month summaries). Examples (omit empty ones):
   - work／career／major projects
   - daily life／health／places
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／wider world (only if it shaped *this* year for the person)
2. For **each kept dimension**, one **short paragraph** (or two) under its own `##` title: the year’s through-line, turning points, what held steady.
3. **Inside that section, narrate in time order.** Prefer: 年初／上半年 → 年中 → 下半年／年底, or seasons／named months (`2026-05`, 「五月」, 「盛夏」). When a month or notable day is known from `lower[]`, name it. Do **not** open a section mid-story with no time frame; give the reader「何時」before or with the first beat.
4. Order **sections** by what mattered most that year. Order **facts inside a section** by time.
5. More abstract than month; fewer tiny day details — but **keep temporal orientation**. Fuse into coherent prose; do not paste month paragraphs end-to-end.

## Shape (required)

```markdown
## Short title

Paragraph (chronological through-line within the dimension)…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `家人與鄰居`). **Do not** lock to a fixed label set every year.
- At least **one** `##` section; if ≥2 dimensions have substance, emit ≥2 sections.
- Do **not** start with the year id (`2026 —`).
- Concise; no `…` mid-cuts.

## Hard bans

- **No** top-level “January… February… March…” (or month-id) spine as the main page structure.
- No bullet catalog of month／week ids.
- No paste／truncate-stack of lower Currents.
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration in the output file（“Reading the write context…”, “Writing…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／month／season）.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise.
