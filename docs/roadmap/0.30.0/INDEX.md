# 0.30.0 — 釐清（Clarify）：補問＋順帶補充 → 入夢蒸餾進 nodes

← [changelog](../../../changelog.md) · 上游：[0.29.0](../0.29.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md) · 來源：[backlog reflective-cognition-prompts](../backlog/reflective-cognition-prompts.md)

> **狀態：** **planned**（構想已大量收斂；**開工前仍須拍板**未清空前不可當「讀完即可開工」）  
> **本版只做這一項：** 第五場景 **釐清**＋store 三 queue（`asking`／`pending`／`history`）＋入夢末段兩獨立 job（`clarify_distill` → `clarify_generate`）；distill 結果進**同一輪 dream draft 的 node 主檔**，**approve 與 L2 一併生效**並將已處理 pending 歸檔。**不做**其他 backlog（graph、vector、Seek 活躍分、shared Zod 等）。

## 產品句

> 每次入夢末段，系統以有好奇心的智能體從本輪夢內容（不足則從熱門 nodes）產出 **3–5 則補問**，累積於釐清場景；人在 **釐清** tab 回答補問或寫 **順帶補充**（皆非 activity、不進 day ledger）。已答內容進 `pending`；下次入夢先 **一次讀整包 pending** 蒸餾進 draft **nodes only**，再生成新補問；人在 Consolidate 審這輪（含釐清沉澱）後 **approve** 才寫入 live L2，並把本輪處理過的 pending 移到 `history`。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、非目標、待拍板、軌道草圖、驗收草圖 |
| 2 | [docs/reasoning.md](./docs/reasoning.md) | 為何獨立 clarify 層、為何經人審、為何只改 nodes、否決方案 |
| 3 | [../backlog/reflective-cognition-prompts.md](../backlog/reflective-cognition-prompts.md) | 早期構想；**產品真相以本版為準** |

（開工前應再補：`docs/queues-and-pipeline.md`（路徑／檔案固定結構／dream 階段順序）、API 契約摘要或併入 api-docs 草稿。）

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
| 1 | 場景 tab | 中文 **釐清**；英文 domain **Clarify**；場景 id 建議 `clarify`（實作可再確認與 Topbar 一致） |
| 2 | 卡片區小標 | **補問**＝系統產生、等人回答的問題 cards |
| 3 | Freestyle 區 | **順帶補充**＝人自發寫的任意內容（textarea）；與補問分區；**本版不做**附圖（可列未來） |
| 4 | Card 操作 | 每則補問：問題正文 + textarea + **submit** + **dismiss**；dismiss＝**真刪**該則 asking 檔 |
| 5 | 與 Seek | Seek 仍＝人問系統；釐清＝系統補問人＋人順帶補充；**不**共用輸入框 |
| 6 | 術語 | Store／程式／path 用 **clarify**；**不用** wonder／FAQ 當正式 domain 名 |

### Store：三 queue

| # | 題 | 決定 |
|---|-----|------|
| 7 | 根路徑 | **`memories/clarify/`**（進 store git，與 nodes 同級追蹤） |
| 8 | `asking/` | 一則一檔 markdown；**固定結構**；**只有問題**（無答案） |
| 9 | `pending/` | 一則一檔；**固定結構**；**問題＋答案**（補問 submit：從 asking **move** 過來並寫入答案）；順帶補充可直接以 `kind: aside`（或等價）進 pending |
| 10 | `history/` | 從 pending **move** 過來；**僅備份、不再讀** |
| 11 | 非 activity | 補問答覆與順帶補充 **不**寫 L0、**不**寫 short-term pool、**不**進 day ledger／chain |
| 12 | asking 上限 | 進行中補問最多 **10**；每次 generate 新產 **3–5** 則 |
| 13 | 超過 10 | 由 AI **存留／改寫／刪除**至 ≤10；**pruned＝真刪、不進 history、不留審計／retry 追蹤**；日後可再問同類題 |
| 14 | 檔案結構 | asking／pending 皆須 **固定 structure**（frontmatter＋標題段）；精確 schema 見待拍板／後續 docs |

### 入夢 pipeline（末段兩 job）

| # | 題 | 決定 |
|---|-----|------|
| 15 | 順序 | 既有 extract → materialize → rollup **之後**，進入 `pending_review` **之前**：先 **`clarify_distill`**，再 **`clarify_generate`** |
| 16 | Distill | 獨立 job／prompt：讀 **整包** `clarify/pending/*`（一次集合，**不**逐檔串行以免互相覆寫）→ 寫入**本輪** dream draft 的 **node 主檔 only** |
| 17 | Distill 白名單 | **只准**改 draft 下 `memories/nodes/{id}/{id}.md`；**不准**改 chain、ledger、future-sight |
| 18 | Generate | 獨立 job：依**本輪夢內容**發掘相關補問；夢內容不足則從**熱門 nodes**（既有 score／`display_score`）出發；寫入 `asking/`（並在 >10 時 prune） |
| 19 | Rollup-only | short-term pool 空、僅 rollup catch-up 的入夢：**仍跑** `clarify_distill` + `clarify_generate` |
| 20 | Pending 為空 | distill **skip**（或 no-op）；generate 仍可跑 |
| 21 | Distill 時檔案位置 | distill **只讀寫 draft nodes**；`pending/` 檔案在 distill 完成後 **仍留在 pending**（不提前搬 history） |
| 22 | Report／UI | 本輪因釐清產生的 draft node 改動須在 Consolidate **可見**（report 建議獨立段如 `## 釐清沉澱`，或等價清楚呈現；精確標題待拍板） |

### Approve／Discard

| # | 題 | 決定 |
|---|-----|------|
| 23 | Approve | 既有 deploy draft→live L2（含釐清蒸餾的 node 變更）＋清 short-term scope；**並**將本輪有被 distill 處理的 `clarify/pending/*` **move → `history/`** |
| 24 | Discard | 只丟 dream draft（照舊）；**`asking/` 留著**；**`pending/` 原地不動**（不進 history） |
| 25 | 不 silent 寫 L2 | 釐清內容**不得**在 approve 前寫入 live nodes；須經 `pending_review` 人審 |

### 產品邊界

| # | 題 | 決定 |
|---|-----|------|
| 26 | 修錯 activity | **不**用順帶補充當 activity 編輯器；寫錯事件仍靠 **Activities 再寫更正**。釐清只承諾更新 **nodes 理解** |
| 27 | 來源構想 | 取代 backlog「反思補問」粗構想中「走 activities + source」的閉環；改為 clarify 三 queue |

---

## 開工前仍須拍板

| # | 題 | 備註 |
|---|-----|------|
| A | Markdown 固定結構 | frontmatter 欄位（`kind`／`id`／timestamps／`related_nodes`／`source_dream_run_id`…）；`## Question`／`## Answer` 是否強制；aside 是否省略 Question |
| B | HTTP API | list asking／submit answer／dismiss／submit aside；錯誤碼；與 dream lock 互斥 |
| C | `store_version` | 是否 bump＋migrate hop（新建 `clarify/` 空目錄？舊庫 ensure？） |
| D | Generate 細節 | 「熱門」取 top-N 多少；是否避開本輪剛 heavy-update 的 nodes；prompt 位置 |
| E | Report 段名與 pending API | Consolidate 如何暴露釐清變更清單；是否進 `GET /dreams/pending` |
| F | Retry／amend | re-dream／amend 是否重跑 clarify jobs；與凍結 scope 的關係 |
| G | Housekeep | history 是否按年月分桶／上限；久未答的 asking 是否另設 TTL（目前僅靠上限 10＋AI prune） |
| H | Topbar／i18n | 五場景順序；badge（open 補問數）是否本版做 |

**未清空本表前，狀態維持 `planned`，不可開實作 agent 當自足開工。**

---

## 非目標

- 用釐清／順帶補充改寫 L0 activity 或 day ledger
- Distill 寫 chain／future-sight
- Prune／dismiss 的審計 log、retry 追蹤、「不可再問」黑名單
- Seek 場景內嵌系統提問；Activities 旁常駐補問打擾 capture
- 獨立第六種「待辦 inbox」產品名（釐清即唯一場景）
- 順帶補充附圖（未來可接 0.29 attachment 模式）
- Node network graph、vector search、Seek 依活躍分、shared Zod package
- 系統未經 approve 自動改 live L2
- 通用 chatbot 式無限追問

---

## 實作軌道（草圖；拍板後再細化驗收）

### Track A — Store＋契約＋dream 兩 job

- **做：** `memories/clarify/{asking,pending,history}/`；檔案校驗；pipeline 末段 `clarify_distill`／`clarify_generate`；approve 歸檔 pending；discard 不動 clarify queues；rollup-only 仍跑兩 job；distill 白名單僅 node 主檔
- **不要：** silent live 寫入；distill 改 chain／future-sight
- **驗收：** 見下方 checklist（拍板後補 API 名）

### Track B — Web 釐清場景＋Consolidate 呈現

- **做：** 第五 tab **釐清**；補問 cards（submit／dismiss）；順帶補充區；Consolidate 顯示釐清所致 node draft 變更
- **不要：** 與 Seek 共用輸入；把釐清做成 admin badge 牆
- **驗收：** 心智模型可演示：答補問 → 入夢 → 審夢見變更 → approve → pending 進 history

### Track C — 文件與出貨

- **做：** api-docs、AGENTS、domain-language、workbench skill、version／changelog；backlog 反思補問條改指本版或出貨後刪除
- **驗收：** 詞彙統一（釐清／補問／順帶補充／clarify queues）；`test:phases` 含主路徑

---

## 驗收（草圖）

- [ ] 入夢末段順序：… → `clarify_distill` → `clarify_generate` → `pending_review`
- [ ] Rollup-only 仍執行兩 clarify job
- [ ] Distill 一次讀整包 pending；只改 draft node 主檔
- [ ] Generate 每輪 3–5 則；asking ≤10；超出由 AI prune（真刪）
- [ ] Submit 補問：asking → pending（含答案）；dismiss：刪 asking
- [ ] 順帶補充進 pending；不進 L0／ledger
- [ ] Approve：L2 含釐清 node 變更；處理過的 pending → history
- [ ] Discard：asking 與 pending 皆保留
- [ ] Consolidate UI 可見釐清所致 draft 變更
- [ ] 文件／domain-language 齊；backlog 連結正確
- [ ] （拍板後）`store_version`／migrate 行為符合定案
- [ ] `bun run test:phases` 通過

---

## 錨點檔案（開工前必讀）

| 路徑 | 用途 |
|------|------|
| `server/src/dream/execute/pipeline.ts` | 入夢階段順序；末段掛 clarify jobs |
| `server/src/store/dreams/file-pipeline.ts` | Draft 白名單／finalize |
| `server/src/api/`（dreams／memories） | 新 clarify API 掛載點 |
| `web/src/App.tsx`／`Topbar.tsx` | 場景切換 |
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
| 進 L2 的新路徑 | 附圖經 activity／dream | 釐清經 draft nodes＋approve |

← [0.29.0](../0.29.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
