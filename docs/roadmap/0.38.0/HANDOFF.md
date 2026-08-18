# Handoff — Implement Engram 0.38.0

**To:** implementing agent（不需要先前聊天紀錄）  
**From:** 規劃（2026-08-18）  
**Product repo:** Engram（根目錄 `AGENTS.md`）  
**與使用者對話：** 繁體中文書面語

---

## Your mission

Ship **0.38.0**：讓 chain **day summary** 與 **week／month／year** 摘要讀起來像有取捨的文章（可分段、禁止打包／合訂本），不是下層全文再貼一次。

只做 INDEX 寫明的事：**prompts ＋ mock 形狀 ＋ summary 過程句 soft lint ＋ phases／文件**。

**不要發明範圍。** [`INDEX.md`](./INDEX.md) 與連結文件是唯一真相。

**Out of scope：** 新 API、記憶鏈 UI、歷史 backfill、migrate、抬 boot gate、用字數擋 approve、改 node standing 骨架、改 ledger 為文章。

---

## Read first（順序）— then implement

1. [`AGENTS.md`](../../../AGENTS.md)
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md) · [`agent-workflow.md`](../agent-workflow.md)
3. **[`docs/roadmap/0.38.0/INDEX.md`](./INDEX.md)**
4. [`docs/chain-prose.md`](./docs/chain-prose.md) — 海拔、prompt 義務、好／壞例、mock 形狀
5. [`docs/reasoning.md`](./docs/reasoning.md) — 僅當語意含糊；**衝突時 INDEX 勝**

開工時把 INDEX 狀態改為 **`in progress`**。

---

## Suggested order

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | 改 extract／dream-files／rollup-write-*／amend；刪衝突句（每節一段、保留全部 lower link） |
| 2 | **B** | `fuseMockNarrative` 與 day mock；`structure-notes` 過程句；單元測試；`test:phases` |
| 3 | **C** | `version.md`／`changelog.md`／AGENTS 版本句；INDEX → shipped |

每軌後跑該軌測試；全部結束跑 **`bun run test:phases`**。建議另開 agent 寫 `docs/implementation-review.md`。

**Do not commit unless the user asks.**

---

## Critical invariants

1. 無新 HTTP；boot gate 仍 ≥0.36；無 migrate hop。
2. Day ledger 不文章化；只改 summary 與 higher rollup 契約。
3. 不批量改 live `ENGRAM_STORE_DIR` 舊摘要。
4. P1 仍要：節內對已知 node **首次**必須 link；非回填維持。
5. Soft lint 只警告過程句（加既有 0.31 規則）；永不 fail dream／approve。
6. Mock 必須確定性、以 `##` 開頭、有 P1、非 lower 全文 paste。

---

## Anchor code

| Path | Why |
|------|-----|
| `server/prompts/extract.md` | `chain.summary` |
| `server/prompts/dream-files.md` | day 寫入＋P1 |
| `server/prompts/rollup-write-week.md` 等 | 現行「一段＋preserve links」 |
| `server/prompts/amend-dream.md` | 小修 chain |
| `server/src/agent/rollup/mock.ts` | `fuseMockNarrative` |
| `server/src/dream/report/structure-notes.ts` | summary lint |
| `server/src/cli/self-test.ts` | week／month summary asserts |

---

## Starter prompt（貼給新實作 agent）

```text
實作 Engram 0.38.0。只讀 docs/roadmap/0.38.0/INDEX.md 與其連結（尤其 docs/chain-prose.md 與 HANDOFF.md）。改 chain 摘要寫作契約：day 可碎須分段；week／month／year 必須取捨、禁止合訂本。改 prompts、mock、過程句 soft lint、phases。不要新 API、不要 migrate、不要改 live 舊摘要、不要字數硬閘門。對使用者用繁體中文書面語。未要求不要 commit。
```
