# Handoff — Implement Engram 0.32.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-13)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.32.0** only this:

1. Activities **`@` mention composer**（ref＋create pills）  
2. **`raw` 內嵌 token** 為關聯真相（`node:`／`node-create:`）  
3. **廢除 `node_refs`**（新請求 → 400；舊 JSONL 讀取忽略）  
4. Dream 依 mentions 消歧／create；漏建 **軟警告**

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + linked docs are the sole source of truth.

**Out of scope:** Clarify／Seek composer、node rename／merge、vector mention search、歷史 migrate 剝 `node_refs`、graph GUI、抬 boot gate。

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md)  
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md)  
3. [`docs/roadmap/agent-workflow.md`](../agent-workflow.md)  
4. **[`docs/roadmap/0.32.0/INDEX.md`](./INDEX.md)**  
5. [`docs/mention-contract.md`](./docs/mention-contract.md)  
6. [`docs/reasoning.md`](./docs/reasoning.md) — only if ambiguous；**INDEX wins**

---

## One-paragraph product summary

Activities becomes a composer: type `@` to pick an existing node (ref pill) or confirm create-intent for a new id. Submit writes those as `[@label](node:id)` / `[@label](node-create:id)` inside `raw`. Server rejects any `node_refs` key with 400. Dream parses mentions from events—must seed draft nodes for creates; missing create → Structure notes warn only. Old JSONL `node_refs` ignored on read; no store migrate.

---

## Suggested implementation order

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | API reject `node_refs`；parse mentions；capture／STM／context；phases |
| 2 | **B** | prompts＋mock create／ref；soft warn；phases node file |
| 3 | **C** | Activities composer UI；remove refs field |
| 4 | **D** | api-docs／domain-language／AGENTS／integration skill／changelog／version；delete backlog row；INDEX → shipped |

Set INDEX status to **`in progress`** when you start.

**Testing：** each Track narrow tests → finally `cd server && bun run test:phases` → prefer new agent for `docs/implementation-review.md`.

---

## Critical invariants

1. Mention **truth = raw tokens** only（本版無必填 JSON 側車）。  
2. `node_refs` on POST → **400**；never silently accept.  
3. `node-create` + live id exists → **400**；do not auto-convert to ref.  
4. Create miss in draft → **warn only**；do not fail dream／approve.  
5. Clarify／Seek **unchanged** input UX.  
6. No store migrate； boot gate ≥0.28.  
7. Attachment embeds rules unchanged.

---

## Anchor code

| Path | Why |
|------|-----|
| `web/src/scenes/ActivitiesScene.tsx` | textarea＋node_refs UI |
| `server/src/api/activities.ts` | validation |
| `server/src/store/memories/capture.ts` | L0 write |
| `server/src/store/memories/short-term-memory.ts` | refs-derived notes |
| `server/src/dream/execute/context.ts` | context `node_refs` |
| `server/prompts/dream-files.md` | node create rules |
| `server/src/agent/dream/mock.ts` | fixtures |
| `server/src/cli/self-test.ts` | Phase 9 |

---

## Done checklist

- [ ] INDEX 驗收全勾；status → `shipped`（phases 綠＋無未關 HIGH 審查後）  
- [ ] api-docs／domain-language／AGENTS／activities-integration／changelog／version  
- [ ] backlog `activity-node-mentions` **刪除**（出貨後）  
- [ ] `bun run test:phases` 綠  
- [ ] **Do not commit unless the user asks**

---

## Paste-ready starter prompt

```text
你是 Engram 0.32.0 實作 agent。只認檔案，不認 chat history。
對使用者用繁體中文書面語（AGENTS.md）。

先讀（依序）：
AGENTS.md → docs/roadmap/0.32.0/HANDOFF.md → INDEX.md
→ docs/mention-contract.md
（有歧義再讀 reasoning；衝突時 INDEX 勝）。

任務：Activities @ mention composer＋raw token 真相＋廢 node_refs＋dream create/ref（漏建軟警告）。
跟 Track A→B→C→D；禁非目標；INDEX 沉默才提問，否則跟已定案。
每 Track 結束跑窄測；全部結束跑 cd server && bun run test:phases。
Do not commit unless the user asks.
開始前把 INDEX 狀態改為 in progress。
```
