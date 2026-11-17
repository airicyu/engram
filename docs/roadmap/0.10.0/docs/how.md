# 0.10.0 HOW

## Rewrite

When `engram-distill` creates or updates `memories/nodes/{id}/{id}.md` in this run, it writes Standing facts and Current situation again as whole sections. It does not append a new dated block under the previous text.

Current situation is one present picture in full sentences. When folding into that picture, a one-day event, a version number, or a menu may leave this section without first being contradicted; the detail stays in the day file. A sentence that still describes the present stays, unless a later claim in this node file, a pool event in this run, or a clarify item this run absorbs contradicts it. Another day file is not proof by itself that a present sentence is no longer true.

Standing facts is a bullet list of facts that still hold. One fact is one bullet. Two bullets that say the same fact become one. A bullet is deleted only when a later claim in this node file, a pool event in this run, or a clarify item this run absorbs supersedes it. Another day file is not a reason by itself to delete a bullet that still holds. A bullet does not end with an "as of {date}" diary tail.

Identity and Relation stay unless this run changes who or what the node is, or a relationship. Frontmatter stays, except an alias added under the 0.7.0 rule.

Do not open a node only to apply this rewrite, and do not save a node this run did not create or update. Reading a node to see whether this run should update it stays as it is.

The skill still must not copy a diary into the node. The empty-shell delete rule is unchanged.

## Program

No new check. The server does not read these sections to decide whether the rewrite happened. Acceptance is the skill text and `docs/data-spec.md`.

## Example shape

A fictional project node after a run that learned the work moved from a store listing to a phone build:

```markdown
## Standing facts

- Beacon is a small phone wallet. It is listed on the fictional app store.

## Current situation

The current work is the phone build. The store listing is already up.
```

The day file keeps the version number and the evening the listing went up. The node does not keep an older paragraph that still says the phone build has not started.
