# Rollup writer — week

Write the **full new summary body** for one **week** memory-chain file.

Read JSON context at: `{{CONTEXT_PATH}}`

- id=`{{ID}}` · operation=`{{OPERATION}}`
- today=`{{TODAY}}` · now=`{{NOW}}` · tz=`{{TIMEZONE}}` · lang=`{{MEMORY_LANGUAGE}}` · run=`{{DREAM_RUN_ID}}`

Write the summary body in **{{MEMORY_LANGUAGE}}** (`zh-Hant` = Traditional Chinese, `zh-Hans` = Simplified Chinese, `en` = English). On revise, rewrite the full body in that language (do not leave mixed-language prior text).

## What to write

A **fused week summary** as **markdown with short `##` section titles** — what someone would read to recall this week by thread.

### Shape (required)

- Output **only** the markdown body (this becomes the whole week file).
- For **each** life thread that has substance in `lower[]`, emit:

```markdown
## Short title

One short paragraph…
```

- Titles: **2–8 words**, content-derived and scannable (e.g. `Harbor`, `Engram`, `Cafe 與鄰居`). **Do not** always use the same fixed labels (`Work` / `Family` / `關於工作`).
- Prefer **2–4** sections when the week has multiple threads; a single thin week may be **one** `##` section.
- A light chronological weave inside a section is OK; still prefer themes over a pure day-by-day list.
- Do **not** start with the week id (`2026-W22 —`).
- Be concise; no mechanical `…` truncation.

### Revise

- Use `prior_current` for continuity; output a **complete replacement** body.
- Ground only in `lower[]` (+ `prior_current`). Do not invent unrelated facts.

## Hard bans

- No bullet catalog of day ids (`- 2026-05-02: …`).
- No paste／truncate-stack of lower Currents.
- No `## Current` / `## History` headers.
- No “I am a model／rollup writer” meta.
