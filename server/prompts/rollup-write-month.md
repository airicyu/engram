# Rollup writer — month

Write the **full new summary body** for one **month** memory-chain file.

Read JSON context at: `{{CONTEXT_PATH}}`

- id=`{{ID}}` · operation=`{{OPERATION}}`
- today=`{{TODAY}}` · now=`{{NOW}}` · tz=`{{TIMEZONE}}` · lang=`{{MEMORY_LANGUAGE}}` · run=`{{DREAM_RUN_ID}}`

Write the summary body in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = Traditional Chinese, `zh-Hans` = Simplified Chinese, `en` = English). On revise, rewrite the full body in that language (do not leave mixed-language prior text).

## Purpose

A **month retrospective** — as if someone reviewed the weeks and wrote what this month *was* about. Scannable by life dimension; each section should feel like a short story arc with **month-scale time sense**.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early month → mid → late month, with clear time anchors.

This is **not** a chronological diary of every day／week as the page spine (no top-level week-by-week tour of the whole month). Group by what mattered; **within** each group, tell the arc in time order.

## How to think (required)

1. Ask: **which life dimensions mattered this month?** Only keep dimensions that actually have substance in `lower[]` (week summaries). Typical examples (not a fixed checklist — omit empty ones):
   - work／career／projects
   - daily life／health／places／routines
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／news／wider world (only if it touched *this* person’s month)
2. For **each kept dimension**, write **one short paragraph** (or two if the arc needs a beat) under its own `##` title — outcomes, tensions, turning points.
3. **Inside that section, narrate in time order.** Prefer: 月初／上旬 → 月中 → 下旬／月底 (or equivalent in {{MEMORY_LANGUAGE}}). When a concrete day or week is known from `lower[]`, name it (`2026-07-18`, `2026-W29`, 「七月中」). Phrase anonymous beats as「有一天／某週末」only when the exact day is truly unknown — **never**「這天」with no referent.
4. Order **sections** by importance for *this* month (most defining first). Order **facts inside a section** by time.
5. Fuse: rewrite into coherent prose. Do **not** merely concatenate lower sentences.

## Shape (required)

```markdown
## Short title

Paragraph (chronological arc within the dimension)…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Forbidden** as a rigid every-time set: `Work` / `Family` / `關於工作` / `關於家庭`.
- At least **one** `##` section; if ≥2 dimensions have substance, emit ≥2 sections.
- Do **not** start with the month id (`2026-05 —`).
- Be concise; trust summary judgment; no `…` mid-cuts.

## Hard bans

- **No** top-level linear tour of the whole month (week1→week2→week3…) as the main page structure.
- No bullet catalog of week／day ids.
- No paste／truncate-stack of lower Currents.
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration before／after the markdown（“Reading the write context…”, “Writing…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／part of the month）.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise.
