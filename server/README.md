# Server layout

Bun HTTP entry: [`index.ts`](./index.ts) (`bun run dev`).

```
server/
  index.ts              # routes + static web
  store.ts              # barrel → vault (scripts/tests)
  config/
    paths.ts            # ENGRAM_LITE_STORE_DIR, port, vault path helpers
  vault/
    memories.ts         # pool, chain, nodes, clarify, attachments, search, graph
    index.ts            # public vault API
  chain/
    time.ts             # ISO week ids, YYYY-Www-MMDD
  nodes/
    id.ts               # node id validation
    score.ts            # activity_score frontmatter
  future-sight/
    index.ts            # upcoming / longTerm zones
  jobs/
    index.ts            # job JSON under {store}/jobs
  worker/
    pi.ts               # distill / ask Pi orchestration
  git/
    store-git.ts        # local-only store commits
  markdown/
    embeds.ts           # wikilink normalize (import, vault)
  test/                 # integration + contract tests
```

**Skills write vault**; server does control-plane I/O and 202 jobs—not writing rules in TypeScript.
