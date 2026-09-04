# 0.45.0 — 入夢少開多餘 agent、凍結 node 改名片

← [changelog](../../../changelog.md) · 上游：[0.44.0](../0.44.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **in progress**  
> **本版只改入夢管線成本**（少 spawn、縮小 day-extract 凍結 JSON、generate 的 Claude `--add-dir`）。**不**改 HTTP 動詞、**不**改 UI、**無** store migrate、boot 仍 ≥ **0.40**。  
> **開工前仍須拍板：無。**

## 產品句

> 入夢仍寫出同等的日／節點／週月年正文，但不再為「要不要 rollup」另開 AI、不再每場夢都產提問，也不再把全部 node 主檔塞進凍結 JSON。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/how.md](./docs/how.md) | 機械 plan、generate 門檻、名片 JSON、`--add-dir` |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不綁新 node、為何不平行日塊、否決項 |
| 4 | [docs/design-review.md](./docs/design-review.md) | 初審；同意項已併入本 INDEX（見該檔「規劃收斂」） |

相關：[0.24 rollup-only](../0.24.0/INDEX.md) · [0.30 clarify](../0.30.0/INDEX.md) · [0.38 chain 散文](../0.38.0/INDEX.md)

---

## 問題

一場 `POST /dreams/run` 對每個 agent 職務都 `claude -p`（或 cursor／codex）**冷啟動**。現況在 day extract 之後仍固定：

1. **每層 rollup 先開 planner CLI**，再逐個 writer。Server 的 `enforceRollupPlan` 會把 planner 的 execute／targets **整份蓋掉**（開期不寫；閉期缺檔 → init；閉期已有檔且本場碰到 → revise）。Planner 只留下報告裡的 `reason` 字串。
2. **Clarify generate** 只要 store 裡有任何 node 就開一場，與本場有沒有寫週摘要、asking 滿不滿無關。Distill 在 pending 為空時已 no-op；generate 沒有對應跳過。
3. **Day extract 凍結 JSON** 的 `l2_current[].understanding` 是每個 node 主檔全文（`readAllUnderstandings`）。庫變大時第一場 agent 先吞整包。

人感到「入夢很久」，多數時間在多餘 spawn 與過大 context，不是日文寫作契約本身。

---

## 已定案

### A. 機械 rollup plan（不再 spawn planner）

| # | 題 | 決定 |
|---|-----|------|
| A1 | 誰決定寫不寫 | **只**用既有 `candidatesForRollup` + `enforceRollupPlan`（`server/src/dream/rollup/candidates.ts`）。`runLevel` **禁止**再呼叫 `agent.plan`／`CliRollupAgent.plan`。 |
| A2 | Writer | **不變**：有 targets 時仍逐個 `agent.write`（週→月→年串列；同層仍串列）。0.38 的 `rollup-write-*.md` **不**改寫作契約。 |
| A3 | 報告 | 夢報告「Higher chain rollup」段仍列出 level／execute／targets。`reason` 用 enforce 已有的固定英句（如 `closed period catch-up init`、`touched closed period revise`、空 targets 時 **`no closed periods to roll up`**），**不**再向 LLM 要 reason。 |
| A4 | Mock rollup | `MockRollupAgent.plan` 可留著給**直接測 plan／enforce** 的單測；`runRollupCascade`／`runLevel` 活路徑與 phases **不得**呼叫 `agent.plan` 來決定 targets。 |
| A5 | Prompt／CLI plan | **刪除** `server/prompts/rollup-plan.md`。`CliRollupAgent.plan` **刪除**（或改為 throw 且 **零** `loadPrompt`）。介面 `RollupAgent.plan` 可暫留以編譯 mock；**活路徑不得呼叫**。 |
| A6 | stub 不得污染 skip reason | 餵給 `enforceRollupPlan` 的 stub plan **省略** `reason`（或 `undefined`）。**禁止** `reason: "mechanical"`。`targets.length === 0` 時報告／event 必須是 enforce 既有句 `no closed periods to roll up`（`plan.reason ??` 那條），不得出現 `mechanical`。 |

### B. Clarify generate 門檻

| # | 題 | 決定 |
|---|-----|------|
| B1 | 仍先 no-op | Store **零 node** → generate no-op（0.30 INDEX #35 不變）。 |
| B2 | 滿箱跳過 | `listAskingItems().length >= CLARIFY_ASKING_CAP`（**10**）→ **不** spawn generate、**不**為了 prune 而開 agent。人答掉／dismiss 出空位後，要等到下一次 **滿足 B3** 才再產。 |
| B3 | 週摘要才問 | 本場 `runRollupCascade` 的 **week** 層 `execute === true` 且 `targets.length ≥ 1`（亦即本場至少會／已寫一份 week `*.summary.md`）→ 才允許 generate **一次**。同一場補了多週仍 **只 generate 一次**，不是每週一份一場 agent。 |
| B4 | 不綁新 node | **禁止**用「本場有沒有 create／propose 新 node」當 generate 開關。提問是問既有圖譜（既有 score＋避開本場 update／focus），不是問剛生的 id。 |
| B5 | Distill | **不變**：pending snapshot 空 → distill no-op；有 pending 仍開 distill。 |
| B6 | 失敗／temp | Generate 跳過 **不是**夢失敗。三道門（零 node／滿 cap／無 week）全部在 **`mkdtemp` 之前** return；滿 cap **不** `mkdtemp`、**不** spawn、**不**為 prune 開 agent。觀測：`clarify_generate` message 須含子字串（HOW 表）：`no nodes in store`／`asking at cap`／`no week rollup this run`。 |
| B7 | 選人／題數 | `selectClarifyGenerateCandidates`、`CLARIFY_GENERATE_MIN`／`MAX`（3–5）**不變**；只是較少被呼叫。 |
| B8 | week 旗標 | `week_rollup_executed` **只**來自 cascade **回傳後**的 `reports`（week 且 `execute` 且 `targets.length ≥ 1`）。**禁止**用「week candidates 非空」當開關（開期可被 enforce 丟掉）。測試若 `forceLevels` 使 week execute，門檻視為本場有寫 week。 |

### C. 凍結 context：node 名片

| # | 題 | 決定 |
|---|-----|------|
| C1 | 不再塞全文 | `buildDreamContext` **禁止**把每個 node 的整份 `{id}.md`（或 `readUnderstanding` 全文）放進凍結 JSON。 |
| C2 | JSON 形狀 | `DreamContext.l2_current` 每筆改為：`node`（id）、`live_rel`（固定 `memories/nodes/{id}/{id}.md`）、`identity_excerpt`（見 HOW 機械截取）。**刪除**欄位 `understanding`。`existing_nodes: string[]` 仍為全部 id。事件、mention、當日 chain summary／ledger **不變**。 |
| C3 | Excerpt 來源 | **只**機械截 live 主檔 **整行** `## Identity`（HOW：大小寫、`###`、中文標題皆不認；只用第一個；CRLF 正規化）。**禁止**另開 agent 產 summary。無檔或無該標題 → `identity_excerpt` 為 `""`（空段 `_None_` 仍走 HOW 有標題但正文空的路徑）。 |
| C4 | Prompt | 更新 `server/prompts/dream-files.md`：（1）刪／改「凍結 `l2_current[].understanding`＝整檔；若像日記就整檔改寫」——改為 JSON 只有名片，**像日記與否以 Read 到的全文為準**；（2）清單上仍有 id＋`live_rel`，excerpt 空 **不是**「node 不存在」；（3）本場事件／mention 觸及該 id，或要改寫主檔／依現行理解寫 Relation／wikilink → **必須 Read** live 或 draft 主檔；未 Read 禁止整檔改寫。 |
| C5 | 新 node | 本場 `mentions.mode === "create"` 或 draft 新建：本來就沒有 live 全文；維持既有 seed 契約。 |
| C6 | 其他職務 | Amend、Ask、rollup writer、clarify distill／generate 的 context **不**改成這套名片（本版只動 day extract 凍結檔）。Distill 仍可 Read live／draft node。 |
| C7 | Mock extract | `server/src/agent/dream/mock.ts` **禁止**把 `identity_excerpt` 當整檔 prior。改寫既有 node：`copyLiveIntoDraft`（或等價）後從 **draft／live 主檔全文** 組四段（與今日用 JSON `understanding` 等價）。Excerpt 只出現在凍結 JSON。 |
| C8 | 讀檔次數 | 本版接受：仍對每個 `listNodeIds()` 開檔一次、只把 excerpt 放進 JSON。**不要**改成「只內嵌 mention 的 node」。 |

### D. Generate 不掛整座 store（Claude）

| # | 題 | 決定 |
|---|-----|------|
| D1 | 範圍 | 僅 **clarify generate** 這場 spawn。Day extract、amend、distill、rollup **write**、Ask **仍**須能 Read live `memories/`（Claude 現況 `--add-dir` store）。 |
| D2 | Claude | `ClaudeInvoker` 對 generate job **不要** `--add-dir` `policy.storeDir`。仍可 `--add-dir` 可寫的 temp workdir。用 `AgentJob` 明確旗標（預設仍掛 store，以免漏改其它職務）。 |
| D3 | Cursor／Codex | Generate 本來就以 writable temp 為主；核對 **沒有** 為 generate 額外把整座 store 加進 `--add-dir`／可寫根。不必為本點改 day extract 的 add-dir。 |
| D4 | Generate prompt | 繼續只靠 context JSON（candidate ids、narrative excerpt、asking cap）。**不要**因為少掛 store 就改口讓它去掃 vault。 |
| D5 | 詞彙 | 出貨時改 `docs/domain-language.md`「understanding」列：標明 **HTTP／search 仍整檔**；**dream 凍結 `l2_current` 不再含 `understanding`**。`server/prompts/extract.md` **不必**改（`DreamCliRunner` 不 load）。驗收 generate：看 `logAgentSpawn` 的 **cmd** 不含 store 根，禁止只看型別有欄位。Distill 與 generate 同檔 `cli.ts`：只對 `CliClarifyGenerateAgent` 設 `addStoreDir: false`。 |

---

## 非目標

- 為 planner／generate／extract **分流 model** 或加 `--max-turns`（CLI 預設模型不變；Engram 仍不傳 `--model`）
- 同層多個 rollup writer **並行**；把一天一個 agent 平行寫 5–6 個 day block（day extract 仍是 **一場** agent 寫完整個 scope）
- 改 `dream-files.md` 的日摘要分段／standing 四段標題／wikilink／attachments 契約（**允許** C4：刪凍結全文當日記偵測、改為必須 Read）
- 改 0.38 rollup **writer** 散文契約
- 改 HTTP／UI／hash；store migrate；抬 boot；改 `CLARIFY_ASKING_CAP` 數值
- 拿掉 day extract／writer 的 store `--add-dir`
- 合併 extract＋rollup＋clarify 成單一超長 agent

---

## 與 0.44 對照

| | 0.44 | 0.45 |
|--|------|------|
| 人可見 | 事件頁近期報告 | **無 UI 變化** |
| 入夢 | planner×3 + 每場 generate | 無 planner spawn；generate 僅 week 寫出且 asking 未滿 10 |
| 凍結 | 全 node 全文 | Identity 摘錄 + 路徑 |

---

## 實作軌道

### Track A — 機械 plan

- **做：** `runLevel` 以**無 reason** 的 stub 餵 `enforceRollupPlan`；刪 `CliRollupAgent.plan` 與 `rollup-plan.md`；改 event message（HOW）；測 skip reason 仍為 `no closed periods to roll up`。
- **不要做：** 改 writer prompt；並行 write；stub 寫 `reason: "mechanical"`。
- **驗收：** 活路徑無 `rollup-plan` load；閉期缺檔仍 init、開期仍不寫；skip 報告無 `mechanical`。

### Track B — Generate 門檻

- **做：** `runClarifyGenerate` 在 **`mkdtemp` 前**三道門；pipeline 傳 `week_rollup_executed`（來自 `reports` 而非 candidates）；HOW 三句 event 子字串；無 week → 不 spawn；有 week 且 asking 未滿 10 → 既有 mock generate。
- **不要做：** 用新 node 當開關；每週 target 各 spawn 一次。
- **驗收：** 僅 day extract、week skip 的夢不開 generate agent（mock 模式以「generate 未被呼叫」或 no-op event 為準）。

### Track C — 名片 JSON + prompt

- **做：** 型別與 excerpt unit（含 `### Identity`／無標題／CRLF／8 行）；`dream-files.md` 依 C4；**mock 從 live／draft 全文改寫**（C7）；`logExtractContext` 可記 excerpt 總長。
- **不要做：** 用 LLM 產名片；改 GET `/memories/nodes` 的 `understanding`；只內嵌 mention 的 node。
- **驗收：** 凍結無 `understanding`；mock 不靠 excerpt 當 prior；prompt 含必須 Read 與「空 excerpt ≠ 不存在」。

### Track D — Claude generate add-dir + 出貨文件

- **做：** `addStoreDir`；只 generate 關 store；`domain-language.md`＋api.md／AGENTS 若寫「每場夢必 generate」或「凍結 l2_current＝整檔」；出貨時 version／changelog。
- **不要做：** 改 day extract argv；對 distill 關 store。
- **驗收：** generate **cmd** 不含 store 根；extract 的 cmd 仍含。

---

## 驗收

- [x] `runRollupCascade` 活路徑不 spawn planner；skip `reason` 為 `no closed periods to roll up`（無 `mechanical`）；writer 與 enforce 規則與改前等價
- [x] asking ≥ 10 → generate no-op 且 **無** `mkdtemp`；本場 week 無 targets → no-op；零 node → no-op
- [x] 本場 week 有 targets 且 asking 未滿 10 且有 node → generate **一次**
- [x] 凍結 `l2_current` 無 `understanding`；有 `live_rel` + `identity_excerpt`；mock 改既有 node 讀主檔全文
- [x] `dream-files.md`：未 Read 不得整檔改寫；空 excerpt ≠ 不存在；日記形以 Read 全文判斷
- [x] Claude generate **cmd** 無 `--add-dir` store；day extract **有**；distill 仍掛 store
- [x] `docs/domain-language.md` 區分 HTTP `understanding` 與凍結名片
- [x] 無新 HTTP；無 UI；無 migrate；boot 仍 ≥ 0.40
- [x] `cd server && bun run test:phases` 全綠
- [ ] 出貨時 `version.md`＝`0.45.0`、`changelog.md`、本 INDEX → **shipped**；AGENTS 版本脈絡

---

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `server/src/dream/execute/pipeline.ts` | extract → cascade → distill → generate |
| `server/src/dream/rollup/cascade.ts` | `runLevel`／`agent.plan` |
| `server/src/dream/rollup/candidates.ts` | `enforceRollupPlan`、`candidatesForRollup` |
| `server/src/agent/rollup/agent.ts` | `CliRollupAgent.plan` |
| `server/prompts/rollup-plan.md` | 刪 |
| `server/src/dream/clarify/generate.ts` | 門檻 |
| `server/src/store/memories/clarify.ts` | `CLARIFY_ASKING_CAP` |
| `server/src/dream/execute/context.ts`、`server/src/agent/dream/types.ts` | 凍結 JSON |
| `server/src/store/memories/nodes.ts` | 勿再對 extract 用 `readAllUnderstandings` |
| `server/prompts/dream-files.md` | Read 規則 |
| `server/src/agent/providers/claude.ts`、`server/src/agent/flow/types.ts` | `--add-dir` |
| `server/src/agent/clarify/cli.ts` | generate job 旗標 |
| `docs/api-docs/api.md` | 若有「入夢末必產提問」敘述 |
| `docs/domain-language.md` | `understanding`／`l2_current` 列 |
| `server/src/agent/dream/mock.ts` | prior 改讀主檔全文 |
