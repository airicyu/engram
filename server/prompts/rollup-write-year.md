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

Write the summary body in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = Traditional Chinese written style／繁體中文書面語, not spoken Cantonese or internet slang; `zh-Hans` = Simplified Chinese written style／简体中文书面语; `en` = English). On revise, rewrite the full body in that language (do not leave mixed-language prior text).

## Purpose

A **year retrospective** answering: **what defined this year?** High altitude, still personal; scannable by life dimension; each section a through-line with **year-scale time sense** — **not** pasted month paragraphs.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early year → mid → late year (or spring→summer→autumn…), with clear time anchors.

This is **not** a month-by-month chronology as the page spine (no top-level Jan→Dec tour). Group by what defined the year; **within** each group, tell kept beats in time order.

## How to think (required)

1. Ask: **which life dimensions defined this year?** Only keep dimensions with substance in `lower[]` (month summaries). Examples (omit empty ones):
   - work／career／major projects
   - daily life／health／places
   - relationships／family／love
   - side projects／learning／creative work
   - money／housing／admin
   - society／wider world (only if it shaped *this* year for the person)
2. **Selection is required.** Default omit: restating month-layer paragraphs, every minor project version. Use seasons or first／second half. Omitting a month beat is **not** deleting memory. Pasting month sections end-to-end is a **failed** year summary.
3. For **each kept dimension**, write its own `##` title: the year’s through-line, turning points, what held steady. **One title = one dimension.**
4. **Paragraphs:** default **one beat (or one time-arc) per paragraph**. Several paragraphs per `##` are allowed. Fuse **only** the same through-line. Unrelated → new paragraph or omit.
5. **Inside that section, narrate kept beats in time order.** Prefer: 年初／上半年 → 年中 → 下半年／年底, or seasons／named months (`2026-05`, 「五月」, 「盛夏」). When a month or notable day is known from `lower[]`, name it. Do **not** open a section mid-story with no time frame; give the reader「何時」before or with the first beat.
6. Order **sections** by what mattered most that year. Order **facts inside a section** by time.
7. More abstract than month; fewer tiny day details — but **keep temporal orientation**. Do **not** paste month paragraphs.

## Shape (required)

```markdown
## Short title

Paragraph (through-line)…

Optional later-year paragraph…

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
- No paste／truncate-stack of lower Currents. **Do not paste month paragraphs. Anthology = failure.**
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration in the output file（“Reading the write context…”, “Writing…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／month／season）.

## Node wikilinks (when selecting)

- If you mention an L2 node that still exists in live／this-round context → **first mention in that `##` section** must be P1 `[[nodes/{id}/{id}|{id}]]` (vault = `memories/`; never prefix `memories/`). Later in the same section a spoken name is enough.
- If you **omit** a lower beat, **omit** its wikilinks too. Do **not** copy a lower sentence just to keep a `[[nodes/…]]`.
- If a lower month only used plain prose for a person／project but that node **now** exists → this rollup **may** introduce P1 (new higher summary, not historical day backfill).
- Do **not** invent links for one-off names that are not nodes.

Ground only in `lower[]` (+ `prior_current` on revise). Complete replacement body on revise (new contract, not a stitch of month paste).
