# 0.10.0 — Rewrite a node when distill touches it

← [GUIDELINES](../GUIDELINES.md) · previous: [0.9.0](../0.9.0/INDEX.md) (`shipped`) · [changelog](../../../changelog.md) · [version](../../../version.md) · HOW: [docs/how.md](./docs/how.md) · WHY: [docs/reasoning.md](./docs/reasoning.md)

**Status:** `in progress`

> **Product sentence:** When distill creates or updates a node in this run, it rewrites Standing facts and Current situation so they match their jobs. Current situation is one present picture. Standing facts keep only facts that still hold. Dated episodes stay in the chain. Nodes this run does not touch stay as they are.

> **Decisions still open before start: none.**

## Decided

| # | Topic | Decision |
|---|--------|----------|
| 1 | When | The rewrite applies only to a node file this distill run creates or updates. Do not walk the rest of `memories/nodes/`. A long file is rewritten the next time a run touches that id. |
| 2 | Current situation | Replace the whole section with one present picture: a short block of full sentences, not a stack of dated snapshots. Do not append a new "as of {date}" block under older blocks. When folding into that picture, a one-day event, a version number, or a menu may leave Current situation without first being contradicted; the detail stays in the chain. A sentence that still describes the present stays, unless a later claim in this node file, a pool event in this run, or a clarify item this run absorbs contradicts it. Do not use another day file as the sole proof that a present sentence is no longer true. |
| 3 | Standing facts | Replace the whole section with the facts that still hold. One fact is one bullet. Merge repeated bullets about the same fact. Drop a bullet only when a later claim in this node file, a pool event in this run, or a clarify item this run absorbs supersedes it. Do not use another day file as the sole reason to delete a bullet that still holds. Do not keep a diary tail ("as of {date}: …") on a bullet. Do not delete a fact only to make the file shorter when the fact still holds. |
| 4 | Identity and Relation | Change these sections only when this run changes who or what the node is, or how it relates to another node. Do not restack them. Do not move episode prose into them. |
| 5 | New file | A node created in this run is written once in the four sections. It does not start with a history stack. |
| 6 | What not to invent | Do not add a fact that is not in the existing file or in this run's events and absorbed clarify. Keep wikilinks that the rewritten sentences still need. Keep frontmatter (`aliases`, `activity_score`) as it was, except the alias rule already in 0.7.0. |
| 7 | Empty shell | Unchanged. If Standing facts and Current situation are still empty or placeholder after this rewrite, and the file existed before this run, the existing delete path still applies. A `node-create` skeleton from this run is still not deleted in the same run. |
| 8 | Where it lives | The rules are sentences in `engram-distill` and in `docs/data-spec.md`. The server does not score, diff, or rewrite node prose. No new skill, no new HTTP route, no cron. |

## Out of scope

- A pass that rewrites every node on each distill
- A separate cleanup skill or button
- Rewriting chain files as part of this version
- Changing Ask so it reads nodes that the question did not name
- Maintaining `activity_score`
- Hand-editing a live store inside this version's work

## Acceptance

- [x] `engram-distill` states: a node this run writes has its Standing facts and Current situation sections replaced; Current situation is one present picture; Standing facts are still-true bullets with duplicates merged and superseded claims removed; Identity and Relation change only when identity or relation changed; nodes not touched this run are left unchanged
- [x] `docs/data-spec.md` states the same replace rule for those two sections
- [x] No server code classifies or rewrites node prose for this rule
- [x] `bun test` passes

## Tracks

1. Distill skill sentences (HOW "Rewrite").
2. `docs/data-spec.md` Nodes section, same rule.

## Anchors

`.agents/skills/engram-distill/SKILL.md`, `docs/data-spec.md`.

← [0.9.0](../0.9.0/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
