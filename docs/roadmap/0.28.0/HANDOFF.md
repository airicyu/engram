# Handoff — Implement Engram 0.28.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-09)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.28.0**: refactor L2 node main files to Obsidian-friendly `{id}/{id}.md`, teach dream agents to write **wikilink associations**, add soft **Structure notes** on dream finalize, and ship an **offline store migrate** + boot gate bump.

**Do not invent scope.** The roadmap below is the sole source of truth. Chat history does not exist for you.

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md) — ops boundaries (API for memory state; migrate skill edits store only)
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md) — how roadmap works
3. **[`docs/roadmap/0.28.0/INDEX.md`](./INDEX.md)** — WHAT / decided / non-goals / tracks / acceptance
4. [`docs/node-layout.md`](./docs/node-layout.md) — paths, vault root, migrate mechanics
5. [`docs/structure-growth.md`](./docs/structure-growth.md) — prompt / seed / soft lint layers
6. [`docs/migrate-0.19-to-0.28.md`](./docs/migrate-0.19-to-0.28.md) — hop contract (also copy into migration skill on ship)
7. [`docs/reasoning.md`](./docs/reasoning.md) — WHY (only if a decision is ambiguous)
8. Optional background: `docs/roadmap/0.25.0/` (standing understanding semantics — **path changes, meaning stays**)

Research notes under `research-notes/obsidian/` are **historiography**; if they conflict with `0.28.0/INDEX.md`, **INDEX wins**.

---

## One-paragraph product summary

- Obsidian vault = **`{ENGRAM_STORE_DIR}/memories/`** (not store root; `dreams/` is staging).
- Node standing understanding file: **`memories/nodes/{id}/{id}.md`** (was `understand/what.md`).
- Drop stub `INDEX.md` and empty `understand/`.
- API JSON key stays **`understanding`** (whole file).
- Dream/amend must write node↔node links as **`[[nodes/{id}/{id}|{id}]]`** (path + display name = id).
- After dream finalize: report section **`## Structure notes`** (warnings only; empty → `_None_`).
- Approve does **not** hard-fail on missing headings or dead links.
- Migrate is **offline** (no HTTP): backup → **discard pending** (delete drafts) → rename live `what.md` → `{id}.md` → stamp `store_version: 0.28.0`. Boot min structure **≥ 0.28**. Message must say server need not be running.
- **No** `_attachments/`, no image upload, no full-library wikilink backfill (later dreams rewrite when they touch a node).

---

## Suggested implementation order

Follow INDEX tracks A → E:

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | `nodes.ts` path helpers, create-node seed, browse/search/dream context, write-policy + tests |
| 2 | **B** | `dream-files.md` / `amend-dream.md`, mock runner outputs `{id}.md` + sample wikilink |
| 3 | **C** | Soft lint → inject `## Structure notes` into dream report on finalize |
| 4 | **D** | `migrate-0.19-to-0.28` script + skill md; raise boot gate; self-test hop / refuse-stale |
| 5 | **E** | api-docs, AGENTS, domain-language, workbench skill, `version.md` / `changelog.md`; mark INDEX shipped |

Run `bun run test:phases` before calling it done. Tick every checkbox under INDEX **驗收**.

---

## Critical invariants (do not violate)

1. **Memory ops via HTTP API** when dogfooding live store; migrate hop may edit `ENGRAM_STORE_DIR` per skill rules only.
2. **Draft write roots** still use store-relative `memories/...` under draft; **wikilinks inside md body** use vault-relative `nodes/...` (no `memories/` prefix).
3. Migrate **must not** require a running server or “please discard via API first”.
4. Migrate **must not** rewrite node prose into wikilinks.
5. Do **not** create `memories/_attachments/` this release.
6. Do **not** bump unrelated features (graph UI, merge, vector search, amend API shape, score math).

---

## Anchor code (start grepping here)

| Path | Why |
|------|-----|
| `server/src/store/memories/nodes.ts` | understanding path / create node |
| `server/src/agent/shared/write-policy.ts` | writable draft paths |
| `server/prompts/dream-files.md` | dream write rules |
| `server/prompts/amend-dream.md` | amend rules |
| `server/src/agent/dream/mock.ts` | mock disk shape |
| `server/src/store/store-structure.ts` | boot min `store_version` |
| `server/src/store/dreams/dream-runs.ts` | `discardPending` / draft layout (mirror offline in migrate) |
| `.claude/skills/engram-migration/` | add hop file + script; update SKILL.md table |
| `server/src/cli/self-test.ts` | extend phases for new paths / structure notes / migrate |

---

## When finished

1. INDEX status → `shipped`; all 驗收 boxes checked  
2. `version.md` = `0.28.0`; changelog entry  
3. AGENTS “目前版本脈絡” points at shipped 0.28  
4. Migration skill lists `migrate-0.19-to-0.28`  
5. Tell the user: how to migrate their dogfood store offline (path to skill), and that Obsidian should open `memories/`

**Do not commit unless the user asks.**

---

## Paste-ready starter prompt (for a new agent chat)

```text
Implement Engram 0.28.0 per the roadmap. Do not use chat history; only the files.

Read in order:
1. AGENTS.md
2. docs/roadmap/0.28.0/HANDOFF.md
3. docs/roadmap/0.28.0/INDEX.md and every doc it links

Then implement Tracks A→E, run bun run test:phases, update version/changelog/docs, mark INDEX shipped.
Do not create _attachments. Do not auto-wikilink on migrate. Migrate must be offline and clear pending.
Ask only if INDEX is silent on a decision; otherwise follow INDEX 已定案.
Respond to the user in Traditional Chinese (書面語).
```
