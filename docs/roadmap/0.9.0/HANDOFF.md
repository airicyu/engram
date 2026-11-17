# 0.9.0 HANDOFF

Read this, then `INDEX.md`, `docs/how.md`, and `docs/reasoning.md`. Do not reopen decided rows.

## Product in one paragraph

Clarify questions ask one fact each, and every pending answer is absorbed or dismissed. Future-sight items past `anchor_end` are rewritten by distill, not by GET. `nodes:sidecars` copies a missing score into frontmatter and deletes residual sidecar files. Tracks 1–3 are done.

## Track order

1. Contracts and skill text, plus skill-text tests. Done.
2. `distill-gate.ts` history frontmatter check and unit tests. Done.
3. `server/worker/pi.ts` and job output: no minimum, no retry, max 5 new files, skip reason. Done.
4. Future-sight rewrite: skill, `kind`, GET list-only, Session A on expired items, distill gap. No live model.
5. `scripts/node-sidecars.ts` and fixture tests.

## Do not

- Classify question quality or answer sufficiency in TypeScript.
- Restore a minimum of three or a generate retry.
- Let Ask read `clarify/`.
- Ask clarify questions about missing calendar days.
- Change submit, delete, or aside HTTP bodies.
- Decide in TypeScript whether a future-sight item happened.
- Have GET delete expired future-sight items again.
- Update `activity_score` from distill or the server.
- Print sidecar file bodies.
- Commit unless the user asks.
- Put real vault prose into tests, docs, or fixtures.

## Anchors

`.agents/skills/engram-clarify-generate/SKILL.md`, `.agents/skills/engram-distill/SKILL.md`, `server/worker/pi.ts`, `server/worker/distill-gate.ts`, `server/future-sight/index.ts`, `scripts/node-sidecars.ts`, `docs/data-spec.md`, `docs/api.md`, `docs/architecture/orchestration.md`, `AGENTS.md`

## Done when

INDEX acceptance boxes are checked, `bun test` is green, and the version is left `in progress` until the user says ship.

## Paste-ready starter

```text
Implement Engram 0.9.0 from docs/roadmap/0.9.0/INDEX.md only.
Read INDEX, docs/how.md, docs/reasoning.md, and HANDOFF.md.
Follow Track order. Do not add scope from the backlog beyond the INDEX.
Judgment stays in the skills. The server only counts files, copies a non-empty skip reply, compares `anchor_end` to today, and checks clarify history frontmatter. The sidecar script is mechanical and dry-run by default. Tracks 1–3 are already implemented. Implement Tracks 4 and 5.
Do not commit. Reply in Traditional Chinese.
```
