# 0.45.0 設計審查報告

← [INDEX](../INDEX.md) · [how](./how.md) · [reasoning](./reasoning.md) · [HANDOFF](../HANDOFF.md)

> **日期：** 2026-09-05（初審）  
> **角色：** 設計審查（新 session；只認檔案）  
> **對照基準：** 本版 `INDEX.md` 已定案 A–D＋驗收、`docs/how.md`、`docs/reasoning.md`；對照 GUIDELINES／agent-workflow，以及現行 `cascade.ts`／`candidates.ts`／`generate.ts`／`DreamContext`／`ClaudeInvoker`／`mock.ts`／`dream-files.md`  
> **結論（初審）：** 單主題清楚、非目標夠硬、Track 可開工節奏對；**仍有 HOW／失敗模式未鎖**，建議規劃收斂後再標「待拍板已空」。下列 **D／F 為建議定案（尚未寫入 INDEX）**，審查 agent **未**改 INDEX。
>
> **規劃收斂（2026-09-05）：** D1–D6、F1–F6 **全部同意並已寫入** INDEX／HOW／HANDOFF／reasoning。編號對照：審查 **D1→INDEX A6**（勿與章節 D 的 Claude add-dir D1 混淆）、**D2→C7**、**D3→C4**、**D4→A5**、**D5→章節 D 的 D5**、**D6→B6**；F1→C3／HOW excerpt；F2→C4；F3→C8；F4→D5 驗收 cmd；F5→B8；F6→B6 HOW 表。開工前仍須拍板：**無**。

---

## 1. 總評

| 面向 | 判斷 |
|------|------|
| 產品句／單主題 | **對**：只砍入夢成本，不改 HTTP／UI／migrate |
| 已定案完整度 | A–D 主幹可讀；細節有洞（見 D1–D6） |
| 非目標／防膨脹 | **夠硬**（並行、分流 model、合併超長 agent 皆否） |
| Track＋驗收 | **可勾**；phases 有列 |
| HANDOFF | 有 starter prompt、禁區、INDEX 勝 |
| 「開工前仍須拍板」 | 初審認為 D1、D2、F1 應先併入；**規劃收斂後已空** |
| 隱私 | 未貼 live 記憶正文 |
| 自足（GUIDELINES） | 新 agent 能懂「做什麼」；`mock` 與 `enforce` skip reason 仍可能猜錯 |

---

## 2. 範圍摘要（現行碼對照）

與 INDEX「問題」段一致、審查已核對：

| 題 | 現況（改前） |
|----|----------------|
| Planner | `runLevel`：`agent.plan` → `enforceRollupPlan`；`CliRollupAgent.plan` load `rollup-plan.md` |
| Generate | `runClarifyGenerate`：僅 **零 node** 提早 no-op；滿 10 仍 `mkdtemp`＋spawn，落地後 `pruneAskingToCap` |
| 凍結 | `buildDreamContext`：`readAllUnderstandings()` → `l2_current[].understanding` 全文 |
| Claude | `ClaudeInvoker` **無條件** `--add-dir policy.storeDir`（含 generate） |

活路徑 day extract prompt 是 `server/prompts/dream-files.md`（`DreamCliRunner`），**不是** `extract.md`。

---

## 3. 建議定案（尚未寫入）

| ID | 題 | 建議決定 | 為何必須鎖 |
|----|-----|----------|------------|
| **D1** | `enforce` skip 的 `reason` | stub `rawPlan.reason` **不得**蓋掉 enforce 空 targets 時的既有句。作法二選一寫死：(a) stub **省略** `reason` 或用 `undefined`；(b) `enforceRollupPlan` 在 `targets.length===0` 時 **忽略** 傳入 `plan.reason`，固定 `no closed periods to roll up`（或現行同等英句）。 | 現行 `enforceRollupPlan`：`reason: plan.reason ?? "no closed periods to roll up"`。HOW 的 `reason: "mechanical"` 會讓週月年 skip 報告變成 `mechanical`，與 A3「用 enforce 已有固定短句」衝突，也讓 phases／人讀報告迴歸。 |
| **D2** | Mock extract 的 prior 正文 | `MockDreamRunner` **禁止**把 `identity_excerpt` 當整檔 `understanding` 用。改寫既有 node 時：`copyLiveIntoDraft` 之後，prior 從 **draft／live 主檔全文** 讀（與今日 `touchExistingWhat` 用 JSON 全文等價），excerpt 只存在凍結 JSON 給「真 CLI」看。 | `server/src/agent/dream/mock.ts` 用 `ctx.l2_current[].understanding` 抬 Identity／Standing facts。只改型別會讓 mock 把名片當全文，phases 節點稿品質／skeleton 測會 silently 錯。INDEX Track C 只寫「改 mock 欄位」，HOW 沒寫替代讀檔。 |
| **D3** | `dream-files.md` 日記改寫段 | 刪／改「Frozen `l2_current[].understanding`＝整檔；若像日記就整檔改寫」整段。改為：JSON 只有名片；**若本場事件／mention 觸及該 id，或要改寫主檔，必須 Read `live_rel`**；讀到像日記／流水才抬進四段。C4 的「未 Read 禁止整檔改寫」保留。 | 舊句依賴凍結全文才能發現日記形。名片化後 excerpt 幾乎永遠不像日記，模型可能以為「已經是 standing」而不 Read。 |
| **D4** | `RollupAgent.plan` | 允許介面暫留 `plan()` 給 `MockRollupAgent` 單測；**活路徑** `runLevel`／`runRollupCascade` 不得呼叫。`CliRollupAgent.plan` 本版 **刪除**（或改 throw 且 **零** `loadPrompt(rollup-plan.md)`）。刪 `server/prompts/rollup-plan.md`。 | 與 A5 一致；避免「介面還在所以實作 agent 以為還要 spawn」。 |
| **D5** | 詞彙文件 | Track D 出貨時改 `docs/domain-language.md`「understanding」列：標明 **HTTP／search 仍整檔**；**dream 凍結 `l2_current` 不再含 `understanding`**。`extract.md` **不必**為本版改寫（未被 `DreamCliRunner` load）。 | INDEX 只點名 api.md／AGENTS；domain-language 仍寫 dream `l2_current`＝整檔，新 agent／文件會雙真相。 |
| **D6** | Generate no-op 與 `mkdtemp` | 三道門（零 node／滿 cap／無 week）全部在 **`mkdtemp` 之前** return。滿 cap **不**再為 prune 開 agent（已是 B2；HOW 表格已有，建議 INDEX B6 明示「亦不 `mkdtemp`」）。 | 現行零 node 已在 temp 前 return；滿 cap 若先建 temp 再判斷，會留下空目錄／誤導 spawn log。 |

---

## 4. 失敗模式（建議寫進 HOW 或 INDEX）

| ID | 題 | 建議 |
|----|-----|------|
| **F1** | Identity 截取偽陽性 | 只認 **整行** `^## Identity\s*$`（HOW 已寫）。明示：**不**認 `### Identity`、`## identity`、中文標題。檔內第二個 `## Identity` 忽略（只用第一個）。CRLF：比對前可 `replace(/\r\n/g,"\n")` 或行尾允許 `\r`。 |
| **F2** | 無 `## Identity` 的舊／日記檔 | excerpt `""`（C3）。Prompt 必須說：清單上仍有 id＋`live_rel`；本場要改該 node → **Read**，不可因 excerpt 空而當成不存在。 |
| **F3** | 名片仍讀 N 個檔 | 本版接受：仍 `listNodeIds`＋逐檔讀、只把 excerpt 放進 JSON（問題是凍結 **體積** 不是 open 次數）。**不要**另做「只列 mention 的 node」。 |
| **F4** | Claude `addStoreDir: false` 漏設 | 預設 `true`（HOW 已有）。驗收看 generate 的 **spawn cmd**（`logAgentSpawn`）不含 store 根路徑；**禁止**只看型別有沒有欄位。Distill 與 generate 同檔 `cli.ts`：只對 `CliClarifyGenerateAgent` 關。 |
| **F5** | week 旗標語意 | 用 cascade **回傳後**的 `reports`（HOW 已有）。禁止用「candidates 非空」當開關（開期 week 可在 candidate 集合外被 enforce 丟掉）。`forceLevels` 測若使 week `execute`，generate 門檻視為本場有寫 week。 |
| **F6** | 觀測事件名 | 可保留 `rollup_plan_start`／`rollup_plan_done`（HOW）。Phases／文件若 assert 舊 message `Rollup planner ${level}` 要改。Generate 三句 **子字串** 以 HOW 表為準（`no nodes in store`／`asking at cap`／`no week rollup this run`），現行零 node 句已含第一句，保留即可。 |

---

## 5. 已對齊、無需再拍板

- 不綁「本場新 node」當 generate 開關（B4／reasoning）
- 同場多週只 generate **一次**
- Rollup-only 且 catch-up **寫了 week** → 仍可 generate；僅 month／year → 否
- Distill 條件不變
- GET `/memories/nodes` 的 `understanding` 不動
- Writer／0.38 散文不動；day extract 仍一場
- Claude 只對 generate 去 store `--add-dir`；extract 更需要門（reasoning）
- 無 migrate、boot ≥0.40、不改 `CLARIFY_ASKING_CAP` 數值
- `existing_nodes` 仍全 id；事件／chain 凍結不變
- HANDOFF Track 順序 A→B→C→D 合理（pipeline 傳 week 不依賴名片）

---

## 6. GUIDELINES／workflow 檢查

| 項 | 狀態 |
|----|------|
| INDEX 最低欄位 | 有 |
| reasoning | 有；否決項清楚 |
| **待拍板** | 初審未空；**收斂後已空** |
| HANDOFF＋starter | 有 |
| 雙向 backlog | HANDOFF 稱無獨立 backlog 檔；審查未另核 `backlog/INDEX.md` |
| 審查不改碼 | 本輪僅本檔 |

---

## 7. 驗收對照（設計層：是否可客觀測）

| INDEX 驗收 | 設計是否可測 |
|------------|----------------|
| 活路徑不 spawn planner | 可（無 `rollup-plan` load；spawn log） |
| generate 三門檻＋有 week 一次 | 可（unit 注入 `week_rollup_executed`＋mock） |
| 凍結無 `understanding` | 可（context fixture／unit） |
| `dream-files.md` 必須 Read | 需 D3 寫進 prompt 才勾得住 |
| Claude generate 無 store add-dir | 可（cmd 單測） |
| 無 HTTP／UI／migrate | 範圍清楚 |
| `test:phases` | 出貨門檻；**D2 不鎖則 mock 可能假綠或假紅** |

---

## 8. 後續（規劃收斂）

1. ~~規劃 agent 覆核 **D1–D6、F1–F6**~~ **已做（2026-09-05）**：全部併入 INDEX／HOW；本報告標「已併入」。  
2. 收斂後維持「待拍板：無」才開實作。  
3. 實作仍用現有 HANDOFF starter；衝突以更新後 INDEX 為準。  
4. 碼完成後另開 agent 寫 `implementation-review.md`。

**阻擋「未鎖 D1／D2 就開實作」：已解除。**
