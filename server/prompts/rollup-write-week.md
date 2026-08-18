# Rollup writer — week

Write the **full new summary body** for one **week** memory-chain file.

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

A **week retrospective** answering: **what were this week’s centres of gravity?** Scannable by life thread; inside a thread, readable as selected story — **not** a bound volume of the seven day summaries.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early → late in the week, with clear time anchors.

This is **not** a day-by-day diary of the whole week as the page spine (no top-level Mon→Sun tour). Group by what mattered; **within** each group, tell kept beats in time order.

## How to think (required)

1. Ask: **which life threads were this week’s centre of gravity?** Only keep threads with substance in `lower[]` (day summaries). Typical examples (omit empty ones): work／projects, daily life／health, relationships, side projects／learning, admin／money, etc.
2. **Selection is required.** Lower days contain more than this week must. Omit beats that do not define the week (default drop: menus, full street addresses, gym machine-minutes, **each** version number — rewrite as “shipped 0.29–0.34 this week” if the cadence itself is the story). Omitting a day beat is **not** deleting memory; the day files remain. A paste-anthology of every day is a **failed** week summary.
3. For **each** kept thread, write its own `##` title. **One title = one life thread.** Do **not** combine unrelated threads in one heading.
4. **Paragraphs:** default **one beat (or one time-arc) per paragraph**. The same `##` may have several paragraphs; do **not** cap at one paragraph per section. Fuse into flowing prose **only** when beats are the same arc. Unrelated beats → new paragraph **or omit** the lesser one. Do **not** join brunch, errands, gym, and lunch-box plans with semicolons into one wall.
5. **Inside a section, narrate kept beats in time order.** Prefer: early week → mid → weekend／late week. When a concrete day is known from `lower[]`, name it (`2026-07-18` or「週三」／「週末」 in {{MEMORY_LANGUAGE}} as natural). Do **not** leave bare「這天／今日／that day」with no referent.
6. Order **sections** by importance for *this* week (most defining first), not by calendar. Order **facts inside a section** by time.

## Shape (required)

```markdown
## Short title

Paragraph (one arc)…

Optional second paragraph in the same thread…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Forbidden** as a rigid every-time set: `Work` / `Family` / `關於工作` / `關於家庭`.
- Prefer **2–4** sections when the week has multiple threads; a thin week may be **one** `##` section.
- Do **not** start with the week id (`2026-W22-0525 —`).
- Concise; no mechanical `…` truncation.

## Revise

- Use `prior_current` for continuity; output a **complete replacement** body in this contract (not a stitch of the old anthology plus new days).
- Ground only in `lower[]` (+ `prior_current`). Do not invent unrelated facts.

## Hard bans

- No top-level day-id bullet catalog (`- 2026-05-02: …`) as the page structure.
- No paste／truncate-stack of lower Currents (copy-paste sections without rewriting). **Anthology = failure.**
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration in the output file（“Reading the write context…”, “Writing the summary…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／weekday）.

## Node wikilinks (when selecting)

- If you mention an L2 node that still exists in live／this-round context → **first mention in that `##` section** must be P1 `[[nodes/{id}/{id}|{id}]]` (vault = `memories/`; never prefix `memories/`). Later in the same section a spoken name is enough.
- If you **omit** a lower beat, **omit** its wikilinks too. Do **not** copy a sentence from `lower[]` just to keep a `[[nodes/…]]` that appeared there.
- If a lower day only used plain prose for a person／project but that node **now** exists → this rollup **may** introduce P1 (you are writing a **new** higher summary, not backfilling historical day files).
- Do **not** invent links for one-off names that are not nodes.