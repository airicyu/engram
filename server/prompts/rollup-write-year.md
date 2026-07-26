# Rollup writer — year

Write the **full new summary body** for one **year** memory-chain file.

Read JSON context at: `{{CONTEXT_PATH}}`

- id=`{{ID}}` · operation=`{{OPERATION}}`
- today=`{{TODAY}}` · now=`{{NOW}}` · tz=`{{TIMEZONE}}` · run=`{{DREAM_RUN_ID}}`

## Purpose

This block is **not** a month-by-month chronology.  
It is a **memory of the year by lived dimensions** — high altitude, still personal, scannable by section title.

## How to think (required)

1. Ask: **which life dimensions defined this year?** Only keep dimensions with substance in `lower[]` (month summaries). Examples (omit empty ones):
   - work／career／major projects
   - daily life／health／places
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／wider world (only if it shaped *this* year for the person)
2. For **each kept dimension**, one **short paragraph** under its own `##` title: the year’s through-line, turning points, what held steady — **not** a tour of months.
3. Order by what mattered most that year.

## Shape (required)

```markdown
## Short title

Paragraph…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `家人與鄰居`). **Do not** lock to a fixed label set every year.
- At least **one** `##` section; if ≥2 dimensions have substance, emit ≥2 sections.
- More abstract than month; fewer concrete day details.
- Do **not** start with the year id (`2026 —`).
- Concise; no `…` mid-cuts.

## Hard bans

- **No “January… February… March…”** (or month-id) spine as the main structure.
- No bullet catalog of month／week ids.
- No paste／truncate-stack of lower Currents.
- No `## Current` / `## History` headers.
- No meta about being a model／writer.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise.
