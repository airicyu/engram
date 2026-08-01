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

Write the summary body in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = Traditional Chinese, `zh-Hans` = Simplified Chinese, `en` = English). On revise, rewrite the full body in that language (do not leave mixed-language prior text).

## Purpose

A **week retrospective** a person would write after glancing at the days — scannable by life thread, readable as story inside each thread.

**Outer structure = lived dimensions** (`##` sections).  
**Inner structure (inside each section) = chronological** — early → late in the week, with clear time anchors.

This is **not** a day-by-day diary of the whole week as the page spine (no top-level Mon→Sun tour). Group by what mattered; **within** each group, tell it in time order.

## How to think (required)

1. Ask: **which life threads mattered this week?** Only keep threads with substance in `lower[]` (day summaries). Typical examples (omit empty ones): work／projects, daily life／health, relationships, side projects／learning, admin／money, etc.
2. For **each** kept thread, write **one short paragraph** (or two if needed) under its own `##` title.
3. **Inside that paragraph, narrate in time order.** Prefer: early week → mid → weekend／late week. When a concrete day is known from `lower[]`, name it (`2026-07-18` or「週三」／「週末」 in {{MEMORY_LANGUAGE}} as natural). Do **not** leave bare「這天／今日／that day」with no referent.
4. Order **sections** by importance for *this* week (most defining first), not by calendar. Order **facts inside a section** by time.

## Shape (required)

```markdown
## Short title

Paragraph (chronological within the thread)…

## Another title

Paragraph…
```

- Titles: **2–8 words**, content-derived (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Forbidden** as a rigid every-time set: `Work` / `Family` / `關於工作` / `關於家庭`.
- Prefer **2–4** sections when the week has multiple threads; a thin week may be **one** `##` section.
- Do **not** start with the week id (`2026-W22-0525 —`).
- Be concise; fuse related beats into flowing prose — not a stack of disconnected sentences. No mechanical `…` truncation.

## Revise

- Use `prior_current` for continuity; output a **complete replacement** body.
- Ground only in `lower[]` (+ `prior_current`). Do not invent unrelated facts.

## Hard bans

- No top-level day-id bullet catalog (`- 2026-05-02: …`) as the page structure.
- No paste／truncate-stack of lower Currents (copy-paste sections without rewriting).
- No `## Current` / `## History` headers.
- No meta about being a model／writer.
- No process narration in the output file（“Reading the write context…”, “Writing the summary…”, “已寫入 …”）. **First line must be a `##` title.**
- No deictic time with no anchor（「這天」「今日」「那天」without saying which day／weekday）.
