# 0.30.0 — 釐清（Clarify）：補問＋順帶補充 → 入夢蒸餾進 nodes

← [changelog](../../../changelog.md) · 上游：[0.29.0](../0.29.0/INDEX.md)（shipped）· 下游：[0.31.0](../0.31.0/INDEX.md)（planned）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · 來源：backlog「反思補問」（已刪；產品真相以本版為準）

> **狀態：** **shipped**（2026-08-11；`test:phases` 綠；實作審查 HIGH／同意 MEDIUM 已關）  
> **本版只做這一項：** 第五場景 **釐清**＋store 三 queue（`asking`／`pending`／`history`）＋入夢末段兩獨立 job（`clarify_distill` → `clarify_generate`）；distill 結果進**同一輪 dream draft 的 node 主檔**，**approve 與 L2 一併生效**並將本輪快照內 pending 歸檔。**不做**其他 backlog（graph、vector、Seek 活躍分、shared Zod 等）。

## 產品句

> 每次入夢末段，系統以有好奇心的智能體從本輪夢內容（不足則從高活躍分 nodes）產出 **3–5 則補問**，累積於釐清場景；人在 **釐清** tab 回答補問或寫 **順帶補充**（皆非 activity、不進 day ledger）。已答內容進 `pending`；下次入夢先 **一次讀整包 pending** 蒸餾進 draft **nodes only**，再生成新補問；人在 Consolidate 審這輪（含釐清沉澱）後 **approve** 才寫入 live L2，並把本輪 distill 快照內的 pending 移到 `history`。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 給實作 agent 的開工交接（讀序／禁區／貼上用 prompt） |
| 1 | **本檔 INDEX** | 範圍、定案、非目標、軌道、驗收 |
| 2 | [docs/queues-and-pipeline.md](./docs/queues-and-pipeline.md) | 路徑、frontmatter、HTTP、dream 掛點、approve 歸檔 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何獨立 clarify 層、經人審、只改 nodes、否決方案 |
| 4 | [docs/design-review.md](./docs/design-review.md) | 設計審查；**D／F 已併入本檔已定案**（2026-08-11） |
| 5 | [docs/implementation-review.md](./docs/implementation-review.md) | 實作審查（對 INDEX 驗收） |

---

## 問題（本版要解決什麼）

1. 記憶主循環單向：人寫 activity → 入夢 → L2；系統不會主動說「我想搞懂這件事」。
2. Seek＝人問系統；需要對偶面「系統問人」，且不可與 Seek／Activities 混成同一個輸入框。
3. 補認知若走 activity，會污染 L0／chain；需要**平行管線**，最終仍經 Consolidate 人審進 nodes。

---

## 已定案

### Domain／UI

| # | 題 | 決定 |
|---|-----|------|
| 1 | 場景 tab | 中文 **釐清**；英文 domain **Clarify**；場景 id **`clarify`** |
| 2 | Topbar 順序 | `activities` → `consolidate` → `clarify` → `seek` → `memory` |
| 3 | Badge | **本版不做** open 補問數 badge |
| 4 | 卡片區小標 | **補問**＝系統產生、等人回答的問題 cards |
| 5 | Freestyle 區 | **順帶補充**＝人自發寫的任意內容（textarea）；與補問分區；**本版不做**附圖 |
| 6 | Card 操作 | 每則補問：問題正文 + textarea + **submit** + **dismiss**；dismiss＝**真刪**該則 asking 檔 |
| 7 | 與 Seek | Seek 仍＝人問系統；釐清＝系統補問人＋人順帶補充；**不**共用輸入框 |
| 8 | 術語 | Store／程式／path 用 **clarify**；**不用** wonder／FAQ 當正式 domain 名 |

### Store：三 queue

| # | 題 | 決定 |
|---|-----|------|
| 9 | 根路徑 | **`memories/clarify/`**（進 store git，與 nodes 同級追蹤） |
| 10 | `asking/` | 一則一檔 markdown；**固定結構**；**只有問題**（無答案） |
| 11 | `pending/` | 一則一檔；**固定結構**；**問題＋答案**（補問 submit：從 asking **move** 過來並寫入答案）；順帶補充以 `kind: aside` 進 pending |
| 12 | `history/` | 從 pending **move** 過來；**僅備份、產品不再讀**；本版 **flat**（不分年月桶）、**無**上限／GC |
| 13 | 非 activity | 補問答覆與順帶補充 **不**寫 L0、**不**寫 short-term pool、**不**進 day ledger／chain |
| 14 | asking 上限 | 進行中補問最多 **10**；每次 generate 新產 **3–5** 則 |
| 15 | 超過 10 | 由 AI **存留／改寫／刪除**至 ≤10；**pruned＝真刪、不進 history、不留審計／retry 追蹤** |
| 16 | 檔案結構 | frontmatter：`id`、`kind`（`prompt`｜`aside`）、`created_at`、`answered_at`（pending+）、`source_dream_run_id`、`related_nodes`；body：`## Question`／`## Answer`（aside 省略 Question）。精確字面見 [queues-and-pipeline](./docs/queues-and-pipeline.md) |
| 17 | `store_version` | **無** migrate hop；**不**抬 boot gate（仍 ≥0.28）；`ensureClarifyDirs()`；舊庫無目錄合法（仿 0.29 attachments） |

### HTTP

| # | 題 | 決定 |
|---|-----|------|
| 18 | 前綴 | **`/memories/clarify`** |
| 19 | List asking | `GET /memories/clarify/asking` → `{ items: [...] }`；空＝`[]`；舊→新 |
| 20 | Submit | `POST /memories/clarify/asking/{id}/submit` body `{ answer }`；asking→pending |
| 21 | Dismiss | `DELETE /memories/clarify/asking/{id}`；缺檔 **200** 冪等 |
| 22 | Aside | `POST /memories/clarify/aside` body `{ raw }`；**201**；進 pending |
| 23 | List pending／history | **本版不暴露** HTTP |
| 24 | Lock | dream lock → **409** `dream_locked`；**`pending_review` 仍可**寫 clarify（同 activities） |

### 入夢 pipeline（末段兩 job）

| # | 題 | 決定 |
|---|-----|------|
| 25 | 順序 | extract → materialize → rollup **之後**，進入 `pending_review` **之前**：先 **`clarify_distill`**，再 **`clarify_generate`**（細節掛點見 queues-and-pipeline） |
| 26 | Distill | 獨立 job：讀 **整包** `clarify/pending/*` → 寫入**本輪** dream draft 的 **node 主檔 only** |
| 27 | Distill 白名單 | **只准**改 draft 下 `memories/nodes/{id}/{id}.md`；**不准**改 chain、ledger、future-sight |
| 28 | Distill 時檔案 | pending 檔在 distill 後 **仍留 pending** |
| 29 | Distill 快照 | 開始時 listing → 寫入本輪 **`DreamRunState.clarify_pending_snapshot_ids`**（空／no-op→`[]`）；approve **只**讀此欄，不以 report 為唯一真相 |
| 30 | Distill create | **允許**在 draft 新建尚不存在的 `nodes/{id}/{id}.md`（id 規則同既有 dream create）；仍禁 chain／future-sight／ledger |
| 31 | Distill 白名單違規 | **剔除**違規寫入＋log；不因單次違規整夢失敗；剔除後無合法變更＝no-op |
| 32 | Generate | 獨立 job：依本輪夢內容；不足則 live nodes 按 **`score` 降序 top 8**，並優先避開本輪 involvements 的 `update`｜`focus`；>10 時 prune |
| 33 | Generate 落盤 | agent **只**出結構化結果（或 temp）；**server** 校驗後寫 live `asking/`；**禁止**把 live `memories/clarify`（或更廣 live `memories/**`）加進 dream agent `writableRoots`；結束後 **`stageAndCommitPaths`**（`engram: clarify generate {dream_run_id}`） |
| 34 | Generate 原子性 | 組批校驗後一次寫入；若逐則寫入後整夢失敗 → best-effort 刪本 job 已寫 id |
| 35 | Rollup-only | **仍跑**兩 job；夢內容不足 → **必須**走 score top 8；store **無任何 node** → generate **no-op**（不報錯） |
| 36 | Pending 空 | distill **no-op**；generate 仍跑（選材同上） |
| 37 | Job 硬失敗 | distill／generate runner 崩／逾時／無法落盤 → **整夢失敗**、清 draft、**不** `pending_review`；asking／pending **不**因失敗而回滾既有檔（本 job 部分寫入見 #34） |
| 38 | Job phase | **不**新增 UI `DreamJobPhase`；`DreamIncompleteError.phase` 仍用 **`materialize`**；events／log 標 `clarify_distill`／`clarify_generate` |
| 39 | Report | 段名 **`## Clarify distill`**（空＝`_None_`）；段序：involvements →（rollup）→ **Clarify distill** → Structure notes → Appendix；截斷正則一律含此邊界 |
| 40 | Pending API | `present: true` 時 **`draft_summary` 必為物件**（可 `entry_count: 0`），且必有 `clarify_distilled_node_ids: string[]`（真相＝distill job／server 記錄，非只 parse report；無變更→`[]`） |

### Approve／Discard／Retry／Amend

| # | 題 | 決定 |
|---|-----|------|
| 41 | Approve 歸檔 | 將 `clarify_pending_snapshot_ids`∩仍在 pending 的檔 **move → history/**；快照後新進 pending 留待下輪 |
| 42 | Approve 與 empty_patches | **無論** `empty_patches`，只要快照非空就做歸檔並納入該次 dream git（deploy 失敗則 **不** move）；`l1_clear_pending` 重試路徑 **不再**做 clarify 歸檔 |
| 43 | Approve 順序 | deploy 成功（或確認無需 deploy）→ 歸檔 → 清 STM／去 draft；歸檔第二步失敗 → log＋可重試，不得假裝已歸檔 |
| 44 | Discard | 只丟 dream draft；**asking／pending 不動**；**不得**刪 asking |
| 45 | Retry 清 asking | 重跑 generate **前**，server **真刪** `source_dream_run_id` ∈｛將 discard 的 pending `dream_run_id`｝∪｛retry 鏈上被取代的 run_id｝的 asking 檔（不進 history）；再跑 distill＋generate；`pending/` 仍不動 |
| 46 | Retry | 整段 pipeline → 清本輪來源 asking 後 **重跑**兩 clarify job |
| 47 | Amend | **不**重跑 clarify；**不**重拍快照；**不得**刪 asking；接受「amend 改稿後仍按舊快照歸檔」 |
| 48 | 不 silent 寫 L2 | 釐清內容**不得**在 approve 前寫入 live nodes |

### 寫入競態／校驗

| # | 題 | 決定 |
|---|-----|------|
| 49 | Clarify 寫互斥 | submit／dismiss／aside 短互斥（capture lock 或 `clarify_write`）；同 id 二度 submit → **404**（已不在 asking） |
| 50 | 字串上限 | `answer`／`raw`／Question UTF-8 **≤ 16KiB** → 超限 **400** |
| 51 | `related_nodes` | 非空 string、去重、**不**要求 live 存在；單則最多 **16**；超限 400／generate 不落盤 |

### 產品邊界

| # | 題 | 決定 |
|---|-----|------|
| 52 | 修錯 activity | **不**用順帶補充當 activity 編輯器；寫錯事件仍靠 **Activities 再寫更正** |
| 53 | 來源構想 | 取代 backlog「反思補問」粗構想中「走 activities + source」的閉環 |
| 54 | Housekeep | asking **無** TTL；僅上限 10＋prune＋dismiss |

---

## 開工前仍須拍板

（空 — 2026-08-11 規劃收斂＋design-review 併入。原 A–H 與審查 D1–D9／F1–F7 建議定案已寫入上表。）

---

## 非目標

- 用釐清／順帶補充改寫 L0 activity 或 day ledger
- Distill 寫 chain／future-sight
- Prune／dismiss 的審計 log、retry 追蹤、「不可再問」黑名單
- Seek 場景內嵌系統提問；Activities 旁常駐補問打擾 capture
- 獨立第六種「待辦 inbox」產品名（釐清即唯一場景）
- 順帶補充附圖（未來可接 0.29 attachment 模式）
- Topbar open 計數 badge
- history 年月分桶／上限 GC；asking 日曆 TTL
- `GET` list pending／history
- 新增 UI `DreamJobPhase`；擴 dream agent live `writableRoots` 含 clarify／nodes／chain
- Discard／Amend 時「好心」清 asking
- Amend 後重跑 distill／重拍快照
- Node network graph、vector search、Seek 依活躍分、shared Zod package
- 系統未經 approve 自動改 live L2
- 通用 chatbot 式無限追問

---

## 實作軌道

### Track A — Store＋契約＋dream 兩 job

- **做：** `ensureClarifyDirs`；檔案校驗＋16KiB／related_nodes；clarify HTTP＋寫互斥；pipeline 末段兩 job；`DreamRunState` 快照；approve 含 empty_patches 歸檔；retry 前清本輪來源 asking；generate＝server 落盤＋commit；discard／amend 不刪 asking；report 段＋固定 `draft_summary.clarify_distilled_node_ids`
- **不要：** silent live nodes；擴 agent live writable；migrate hop／抬 boot gate
- **驗收（Track 結束前窄測必含）：** 快照歸檔、discard 不動 queue、retry 後 asking ≤10 且不疊同 run 來源、dream_locked 409、pending_review 可 aside／submit、白名單剔除、empty_patches 仍歸檔；curl 主路徑 aside／submit → run → approve → history
- **Mock：** distill／generate **不**依賴外網；generate 由 server fixture 寫 asking

### Track B — Web 釐清場景＋Consolidate 呈現

- **做：** 第五 tab；補問 cards；順帶補充；Consolidate 可見 report 釐清段（可選高亮 node ids）
- **不要：** Seek 共用輸入；badge 牆；admin dashboard 感；discard 時清 asking
- **驗收：** 心智模型可演示：答補問 → 入夢 → 審夢見變更 → approve → history

### Track C — 文件與出貨

- **做：** api-docs、AGENTS、domain-language、workbench skill、version／changelog；backlog 反思補問出貨後刪列
- **驗收：** 詞彙統一；`test:phases` 至少串 aside→run→approve→history，並覆蓋 retry 不膨脹、empty_patches 歸檔、lock 409

---

## 驗收

- [x] 入夢末段順序：… → `clarify_distill` → `clarify_generate` → `pending_review`
- [x] Rollup-only 仍執行兩 job；無 node 時 generate no-op
- [x] Distill 一次讀整包 pending；只改／可建 draft node 主檔；白名單違規剔除；pending 檔留待 approve
- [x] 快照在 `DreamRunState.clarify_pending_snapshot_ids`；approve 只認此欄
- [x] Generate：server 落盤＋commit；agent writable 不含 live memories；每輪 3–5；asking ≤10；組批／部分失敗回滾本批
- [x] Clarify API＋16KiB／互斥；dream_locked＝409；pending_review 可寫
- [x] Submit／dismiss／aside 行為正確；不進 L0／ledger
- [x] Approve：無論 empty_patches，快照∩pending → history；deploy 失敗不 move；`l1_clear_pending` 不再歸檔
- [x] Discard／Amend：asking 與 pending 皆保留
- [x] Retry：先清本輪來源 asking，再重跑兩 job；之後 asking ≤10
- [x] Report `## Clarify distill` 段序正確；`draft_summary` 在 pending 時必為物件且含 `clarify_distilled_node_ids`
- [x] Web：五場景順序；釐清可答／dismiss／順帶補充；Consolidate 可見釐清段
- [x] 無 migrate hop；ensure 空目錄；boot gate 仍 ≥0.28
- [x] 文件／domain-language／AGENTS／skill 齊；backlog 出貨後刪列
- [x] `bun run test:phases` 通過

---

## 錨點檔案（開工前必讀）

| 路徑 | 用途 |
|------|------|
| `server/src/dream/execute/pipeline.ts` | 入夢階段順序；末段掛 clarify jobs |
| `server/src/store/dreams/file-pipeline.ts` | Draft finalize／manifest |
| `server/src/dream/review/approve.ts` | Deploy＋歸檔 pending 掛點 |
| `server/src/dream/report/finalize.ts` | Report 段序與 narrative 截斷 |
| `server/src/agent/shared/write-policy.ts` | Generate 不可只靠 draft fence |
| `server/src/api/` + `server/src/index.ts` | 新 clarify routes |
| `web/src/App.tsx`／`Topbar.tsx`／`lib/types.ts` | 場景切換 |
| `web/src/scenes/ConsolidateScene.tsx` | 審夢呈現 |
| `docs/domain-language.md` | 補 Clarify／補問／順帶補充 |
| `docs/api-docs/api.md` | 契約 |
| `AGENTS.md` | 操作邊界與產品循環 |

---

## 與上一版對照

| | 0.29.0 | 0.30.0（本版） |
|--|--------|----------------|
| 焦點 | Activity 附圖 | 釐清補問管線 |
| 場景 | 四場景 | **＋釐清** |
| 入夢 | extract＋rollup | 末段 **＋distill pending clarify＋generate 補問** |
| Store 結構 gate | ≥0.28；attachments ensure | 仍 ≥0.28；**clarify ensure、無 hop** |
| 進 L2 的新路徑 | 附圖經 activity／dream | 釐清經 draft nodes＋approve |

← [0.29.0](../0.29.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md) · [agent-workflow](../agent-workflow.md)
