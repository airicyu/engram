# Rollup writer — month

Write the **full new summary body** for one **month** memory-chain file.

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

A **month retrospective** answering: **what was this month’s rhythm and turning points?** Scannable by life dimension; each section a selected arc with **month-scale time sense** — **not** a bound volume of the week summaries.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early month → mid → late month, with clear time anchors.

This is **not** a chronological diary of every day／week as the page spine (no top-level week-by-week tour of the whole month). Group by what mattered; **within** each group, tell kept beats in time order.

## How to think (required)

1. Ask: **which life dimensions set this month’s rhythm?** Only keep dimensions that actually have substance in `lower[]` (week summaries). Typical examples (not a fixed checklist — omit empty ones):
   - work／career／projects
   - daily life／health／places／routines
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／news／wider world (only if it touched *this* person’s month)
2. **Selection is required.** Default omit: single-day restaurant＋dish names, week-layer clock tables, day-by-day version lists. Judgment sentences for shipping cadence and life lines are enough. Omitting a week beat is **not** deleting memory. A paste-anthology of W1＋W2＋W3 is a **failed** month summary.
3. For **each kept dimension**, write its own `##` title — outcomes, tensions, turning points. **One title = one dimension.** Do **not** combine unrelated lines in one heading.
4. **Paragraphs:** default **one beat (or one time-arc) per paragraph**. Several paragraphs per `##` are expected when the month has more than one beat on that line. Fuse **only** the same arc. Unrelated → new paragraph or omit.
5. **Inside that section, narrate kept beats in time order.** Prefer: 月初／上旬 → 月中 → 下旬／月底 (or equivalent in {{MEMORY_LANGUAGE}}). When a concrete day or week is known from `lower[]`, name it (`2026-07-18`, `2026-W29-0713`, 「七月中」). Phrase anonymous beats as「有一天／某週末」only when the exact day is truly unknown — **never**「這天」with no referent.
6. Order **sections** by importance for *this* month (most defining first). Order **facts inside a section** by time.
7. Rewrite into coherent prose at **month altitude**. Do **not** concatenate lower sentences.

## Shape (required)

```markdown
## Short title

Paragraph (one arc)…

Optional later-month paragraph…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Forbidden** as a rigid every-time set: `Work` / `Family` / `關於工作` / `關於家庭`.
- At least **one** `##` section; if ≥2 dimensions have substance, emit ≥2 sections.
- Do **not** start with the month id (`2026-05 —`).
- Concise; trust summary judgment; no `…` mid-cuts.

## Hard bans

- **No** top-level linear tour of the whole month (week1→week2→week3…) as the main page structure.
- No bullet catalog of week／day ids.
- No paste／truncate-stack of lower Currents. **Anthology = failure.**
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration in the output file（“Reading the write context…”, “Writing…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／part of the month）.

## Node wikilinks (when selecting)

- If you mention an L2 node that still exists in live／this-round context → **first mention in that `##` section** must be P1 `[[nodes/{id}/{id}|{id}]]` (vault = `memories/`; never prefix `memories/`). Later in the same section a spoken name is enough.
- If you **omit** a lower beat, **omit** its wikilinks too. Do **not** copy a lower sentence just to keep a `[[nodes/…]]`.
- If a lower week only used plain prose for a person／project but that node **now** exists → this rollup **may** introduce P1 (new higher summary, not historical day backfill).
- Do **not** invent links for one-off names that are not nodes.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise (new contract, not a stitch of old week paste).
