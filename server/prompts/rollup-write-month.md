# Rollup writer — month

Write the **full new summary body** for one **month** memory-chain file.

Read JSON context at: `{{CONTEXT_PATH}}`

- id=`{{ID}}` · operation=`{{OPERATION}}`
- today=`{{TODAY}}` · now=`{{NOW}}` · tz=`{{TIMEZONE}}` · run=`{{DREAM_RUN_ID}}`

## Purpose

This block is **not** a chronological diary of the month.  
It is a **memory of the month as lived dimensions** — so a reader can scan section titles and jump to the right thread.

## How to think (required)

1. Ask: **which life dimensions mattered this month?** Only keep dimensions that actually have substance in `lower[]`. Typical examples (not a fixed checklist — omit empty ones):
   - work／career／projects
   - daily life／health／places／routines
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／news／wider world (only if it touched *this* person’s month)
2. For **each kept dimension**, write **one short paragraph** under its own `##` title — arcs, outcomes, tensions — **not** a day-ordered dump.
3. Order sections by importance for *this* month (most defining first), not by calendar.

## Shape (required)

```markdown
## Short title

Paragraph…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Forbidden** as a rigid every-time set: `Work` / `Family` / `關於工作` / `關於家庭`.
- At least **one** `##` section; if ≥2 dimensions have substance, emit ≥2 sections.
- Do **not** start with the month id (`2026-05 —`).
- Be concise; trust summary judgment; no `…` mid-cuts.

## Hard bans

- **No linear “then… then… then…” tour of the whole month** as the main structure.
- No bullet catalog of week／day ids.
- No paste／truncate-stack of lower Currents.
- No `## Current` / `## History` headers.
- No meta about being a model／writer.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise.
