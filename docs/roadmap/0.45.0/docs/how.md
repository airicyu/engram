# 0.45 HOW — 機械 plan、generate 門檻、名片、add-dir

← [INDEX](../INDEX.md)（衝突時 **INDEX 勝**）

本檔鎖實作細節。產品範圍以 INDEX 已定案 A–D 為準。

---

## A. `runLevel` 不再 plan

現況（改前）：`buildPlanContext` → `agent.plan(planCtx)` → `enforceRollupPlan` → `validatePlan` → 逐 target `agent.write`。

改後：

1. `candidates.length === 0`：行為不變，直接 skip。
2. 仍 `buildPlanContext`（要 `candidate_meta` 給 enforce）。
3. **不要** `await agent.plan`。令 stub 為

   `{ level, execute: false, targets: [] }`

   **不要**設 `reason`（尤其禁止 `"mechanical"`）。再 `enforceRollupPlan({ level, plan: rawPlan, meta, touchedPeriods, forceExecute })`。空 targets 時 `reason` 必須是 `no closed periods to roll up`。

4. `validatePlan` 可留：enforce 輸出必須通過（level 一致、id 皆為 candidate、operation 符合 disk）。
5. `execute === false` 或 targets 空：不 write，與現況相同。
6. 有 targets：既有 for 迴圈 `agent.write` **不要**並行。

`CliRollupAgent.plan` **刪除**（零 `loadPrompt(rollup-plan.md)`）。`RollupAgent.plan` 介面可暫留。Cascade **禁止**呼叫 `agent.plan`。刪 `server/prompts/rollup-plan.md`。

Dream event：`rollup_plan_start`／`rollup_plan_done` 可保留名稱（觀測相容），但 start 不應再表示「LLM planner 已 spawn」。message 可改為 `Rollup mechanical plan ${level}`。

---

## B. Generate 何時 spawn

在 `runClarifyGenerate` **於** `mkdtemp`／`agent.generate` **之前**判斷。建議簽名增加：

```ts
week_rollup_executed: boolean
```

由 `executeDreamPipeline` 在 `runRollupCascade` 之後設定：

```ts
const week_rollup_executed = reports.some(
  (r) => r.level === "week" && r.execute && r.targets.length > 0,
);
```

門檻順序（命中即 return `{ written_ids: [], pruned_ids: [], noop: true }` 並 emit event）：

| 序 | 條件 | event message 須含的可搜字串（書面、穩定） |
|----|------|------------------------------------------|
| 1 | `listNodeIds().length === 0` | `no nodes in store`（可沿用現句） |
| 2 | `listAskingItems().length >= 10` | `asking at cap` |
| 3 | `week_rollup_executed === false` | `no week rollup this run` |
| 4 | 否則 | 既有 generate 路徑（mock 或 CLI） |

`CLARIFY_ASKING_CAP` 已是 10：比較用該常數，不要 magics 第二份。

**不要**讀本場 draft 有沒有新 `memories/nodes/**` 來當開關。

Rollup-only 夢若 catch-up **寫了 week**：`week_rollup_executed` 為 true，在 1、2 未命中時 **會** generate。僅 month／year catch-up、本場 week skip：不 generate。

---

## C. Identity 摘錄演算法

新純函式（建議放 `nodes.ts` 或 `dream/execute/identity-excerpt.ts`），輸入主檔全文，輸出 excerpt 字串。

1. 先將全文 `replace(/\r\n/g, "\n")`（或等價）。用 multiline 找 **第一個** 整行恰好 `^## Identity\s*$`。不認 `### Identity`、`## identity`、中文「身分」標題。找不到 → 回 `""`。
2. 正文＝該行之後到下一個 `^## ` 標題（含 `## Relation`）或 EOF。第二個 `## Identity` 忽略。
3. `trim`。若空 → 回 `"_None_"`（與骨架空段一致）。
4. 以 `\n` 切行，最多保留 **8** 行；若被裁，最後在字串尾加 `…`。
5. 若此時 UTF-16 `length > 500`：`slice(0, 500)` 再加 `…`（可與第 4 步的 `…` 合併成一個）。

**不要**呼叫現有 `readUnderstanding`／`extractCurrentSection` 當摘錄：0.16+ 無 `## Current` 時那是 **整檔**。

`buildDreamContext`：

- `existing_nodes = await listNodeIds()`
- 對每個 id：`live_rel = memories/nodes/${id}/${id}.md`；讀 live 檔（缺檔 excerpt `""`）
- **不要** `readAllUnderstandings()`

`DreamContext`（`server/src/agent/dream/types.ts`）：

```ts
l2_current: Array<{
  node: string;
  live_rel: string;
  identity_excerpt: string;
}>;
```

凍結 JSON 即此物件（既有 `withTempJsonContext`）。Mock dream runner／phases fixture 若手寫 context，改欄位。

`dream-files.md`：刪依賴凍結全文偵測日記的句子。改為：名片不是現行全文；excerpt 空仍表示該 id 在 `existing_nodes`／`l2_current` 裡，要動就 Read `{{STORE_DIR}}/`+`live_rel`（或 draft 對應檔）。讀到像日記／流水才抬進四段。Draft 寫入仍是 `{{DRAFT_DIR}}/memories/nodes/{id}/{id}.md`。

`MockOkRunner`／`touchExistingWhat`：改寫既有 node 時 **Read 主檔全文**（copy live → draft 後讀 draft），**不要** `identity_excerpt`。Unit：excerpt 對 `### Identity`、`## identity` 回 `""`。

---

## D. Claude `--add-dir`

`AgentJob` 增加例如 `addStoreDir?: boolean`（預設 `true`＝與現況相同）。

`ClaudeInvoker.run`：僅當 `job.addStoreDir !== false` 時 push `--add-dir`, `policy.storeDir`。writableRoots 的 `--add-dir` 不變。

`CliClarifyGenerateAgent` 的 `invoker.run({ ..., addStoreDir: false })`。

**不要**把 `addStoreDir: false` 設到 `DreamCliRunner`、rollup write、distill、Ask。

Cursor generate：確認未傳 `cursorExtraAddDirs: [store]`。Codex：generate 的 `--cd` 已是 temp，不要為 generate 加 store add-dir。

---

## 測試建議（不新增 HTTP）

- Unit：`enforceRollupPlan` 既有測仍過；空 stub **無** `reason` 時 skip 句為 `no closed periods to roll up`。
- Unit：excerpt（有 Identity、無標題、`### Identity`、超過 8 行、CRLF）。
- Unit：generate 門檻在 mkdtemp 前（注入 `week_rollup_executed`、asking 長度）。
- `cascade.test.ts`：cascade 在 mock 下仍 write；**不得** assert `plan` 被 cascade 呼叫。
- Mock dream：既有 node 改寫不依賴 excerpt。
- `test:phases`：mock-ok 全綠。
- Generate Claude cmd（若有單測 invoker argv）：不含 store 根。

**禁止**把 live store 的 node／提問正文貼進測試註解。虛構 id 如 `acme`。
