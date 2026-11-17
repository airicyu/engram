# 0.10.0 HANDOFF

Read order: this file → [INDEX.md](./INDEX.md) → [docs/how.md](./docs/how.md) → [docs/reasoning.md](./docs/reasoning.md).

**Product:** When distill writes a node, it replaces Standing facts and Current situation. Current situation is one present picture. Standing facts are still-true bullets. Other nodes are left as they are.

**Track order:** 1 distill skill → 2 `docs/data-spec.md`. Then `bun test`.

**Out of bounds:** No server prose classifier. No sweep of untouched nodes. No new skill or HTTP route. Do not edit a live personal store as part of the change. Do not put real memory text into docs or tests.

**Anchors:** `.agents/skills/engram-distill/SKILL.md`, `docs/data-spec.md`.

## Paste-ready

```text
Implement Engram 0.10.0. Follow docs/roadmap/0.10.0/INDEX.md and docs/how.md only.
Track 1: engram-distill replaces Standing facts and Current situation when it writes a node this run. Current situation is one present picture. Standing facts are still-true bullets; merge duplicates; drop superseded claims. Identity and Relation change only when those changed. Do not rewrite nodes this run does not touch.
Track 2: say the same replace rule in docs/data-spec.md.
No server classifier. bun test. Do not edit a live store. Do not commit unless asked.
```
