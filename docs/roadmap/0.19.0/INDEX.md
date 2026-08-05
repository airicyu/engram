# 0.19.0 — Node 活躍分（score）＋人審可見 category

← [changelog](../../../changelog.md) · 上游：0.18.x（功能基線見 [0.18.0](../0.18.0/INDEX.md)；現行產品見 [version](../../../version.md)） · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 來源：產品討論「node 熱度／活躍分」；非未來視 hot／cold 分區。  
> 相關後續（本版不做）：[backlog dream-draft-edit 2b](../backlog/dream-draft-edit.md)、Seek／network 依分排序（見非目標）。

## 產品句

> 每個 L2 node 有可觀察的活躍帳面分（隨「有結算的 dream」增減，非日曆衰減）；入夢 AI 只判語意 category，script 算分與觸頂降標度；人在 report 看見 category，approve 前可用結構化 API 改錯判——Memory 展示 1–100 相對分；**啟動時若 store 結構代低於 0.19（或缺 `store_version`）則拒啟並提示 migrate**。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [AGENTS.md](../../../AGENTS.md) | 操作邊界；出貨時須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/node-score.md](./docs/node-score.md) | 存檔、常數、boost、downscale、`max_score`、display、空庫邊界 |
| 3 | [docs/dream-score-flow.md](./docs/dream-score-flow.md) | Artifact、report、approve 編排、新建＝S0、`exclude_node_ids`、結構化改 category（2a） |
| 4 | [docs/migrate-0.18-to-0.19.md](./docs/migrate-0.18-to-0.19.md) | 既有 node 補 score；`store_version` |
| 4b | [docs/store-boot-gate.md](./docs/store-boot-gate.md) | 結構代不足／缺鍵 → 拒啟＋migrate 提示 |
| 5 | [docs/reasoning.md](./docs/reasoning.md) | 為何模型 A、為何拆 downscale、為何開機閘門、否決時間衰減／2b 同版等 |
| 6 | [0.16 dream-file-pipeline](../0.16.0/docs/dream-file-pipeline.md) | 現行 draft／approve／git（本版在其上加 score 結算） |

**讀完 1–5（含 4b）即可開工**；無需依賴聊天紀錄。  
**不可開工條件：** 無（待拍板已清空）。

---

## 與 0.18 對照

| 題 | 0.18 | 0.19 |
|----|------|------|
| Node 活躍度 | 無；node 平等 | 每 node `score`＋`score_timestamp`；全域 `max_score` |
| 增減機制 | — | **模型 A**：有 category 才 `+boost`；無日曆衰減；觸 `S_max` → 獨立 downscale |
| 未來視 hot | 日曆近窗分區 | **不變**；與 node score **不同概念**（勿混名） |
| Dream 人審 | approve／discard／retry | 同上，**另加** pending 時結構化修正 involvement category（2a） |
| 自由句改整份 draft（2b） | — | **本版不做** → backlog |
| Seek／Memory | Search／Ask／browse | Memory **展示**相對分；**無**依分 search API |
| 開機 × store_version | 缺鍵／落後結構代仍可啟動 | **結構代 &lt; 0.19 或缺鍵 → 拒啟**＋migrate 提示（非要求等於 product_version） |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 產品模型 | Node **活躍帳面分**（內部 `score`）＋ UI **相對 display**（1–100）。**不做** node 的 hot／cold 區劃（與未來視不同） |
| 2 | 增減模型 | **模型 A**：每次 approve 結算時，**本場前已存在**且 artifact 有列出的 node：`score += boost(category)`。**無**時間衰減、**無**每場全體時間 scale |
| 3 | 同 node 多事件 | 取 **最高** category：`focus` > `update` > `mention` |
| 4 | Category 枚舉 | 僅三值（語意名）：**`mention`**｜**`update`**｜**`focus`**。定義見 [node-score.md](./docs/node-score.md)。禁止 `GRADE_*`／數字档名 |
| 5 | 常數（v1） | `S0=100`；`S_min=50`；`S_target=1000`；`S_max=2000`；`boost.mention=10`；`boost.update=35`；`boost.focus=80`。**本版寫死於 server**（不強制 workspace／env）。若實作順手加配置，優先序須為 workspace → env → 上表，且不得改預設值語意 |
| 6 | 存檔 | 每 node：`memories/nodes/{id}/score.yaml`（`score`、`score_timestamp`）。全域：`memories/node-score-registry.yaml`（至少 `max_score`）。**與** `what.md`／markdown **分離**，供 script 讀寫 |
| 7 | AI vs script | AI **只**產出 involvement：**`node_id`＋`category`**（可選短 reason）。`original_*`／`new_*`／`need_downscale`／`max_score` **一律 script** 計算與寫入。勿讓 LLM 改分數 |
| 8 | 新建 node | 本場新建結束後帳面 **必須＝`S0`**。本場 **不**套 boost（artifact 若列入新建 id → script **忽略**）。`score_timestamp`＝approve 時刻 |
| 9 | Downscale | **獨立 flow**（純 script）：`factor = max_score / S_target`；每 node `score = max(score/factor, S_min)`；刷新被改者之 `score_timestamp`；最後 **重掃** 寫 `max_score`。可選參數 **`exclude_node_ids?: string[]`**（跳過不改那些檔）。**不**接受 `dream_run_id`（避免耦合 dream） |
| 10 | 何時呼叫 downscale | Approve 結算：對既有 node 套用 boost 後，若存在 `score > S_max` → 呼叫 downscale，並傳 `exclude_node_ids = 本場新建 id 列表`。若 `max_score ≤ S_target` → downscale **no-op**（防升分） |
| 11 | 空庫／無 max | 無 node 或尚無 registry：不除零、不 downscale。首場僅新建 → 全 `S0`，`max_score = S0`。Display：無有效 `max_score`（缺失或 `≤0`）→ 顯示「無／—」，不算比例 |
| 12 | Display | `display = ceil(node.score / max_score * 100)`。`score > 0` 時因 ceil **至少為 1**。UI 首版只展示此整數（可選不露帳面分） |
| 13 | Report | 固定標題 **`## Node score involvements`**，位置在 **`## Narrative` 與 `## Appendix — pending deploy` 之間**。Pending 前由 **server**（`finalizeDreamReport`）依 artifact **覆寫／生成**該段（與 Appendix 同為 server-owned）；結算真相仍是 artifact。見 dream-score-flow |
| 14 | Pending 動作 | 保留 approve／discard／retry。**本版新增 2a**：`PATCH /dreams/pending/node-score-involvements`；只改 artifact 已有 id 的 category＋report 段。非法 category → **400** `invalid_category`；id 不在 artifact → **404** `involvement_not_found`；**不**開自由句 agent 改 draft |
| 15 | 結算時機 | **僅** `POST /dreams/approve` 且 **非** `empty_patches` 的成功路徑寫 live score／registry／downscale。**`empty_patches`（無 manifest entries 且無 deletes）→ 不跑分數結算**（仍可清 short-term，與現 approve 等價）。discard／retry／cancel／僅補清 short-term 的 clear-only approve **不**改 live score |
| 16 | Git | Score／registry 寫在 **`commitDraft` 成功之後、同一場 `stageAndCommitPaths` 之前**（掛在 `approveDream`）；路徑併入該次 dream commit。`commitDraft` 失敗則不寫分。分數寫入後若 git 失敗：對齊現況「live 已套用、記 log」（score 視同已套用之 live 變更） |
| 17 | Migration | 結構代變更：既有每個 node 補 `score.yaml`（`S0`＋migrate 時刻 timestamp）；建 registry `max_score=S0`（若有 node）。`store_version` → `0.19.0`。見 migrate 檔 |
| 18 | Browse／API 讀 | `GET /memories/nodes` 與 `GET /memories/nodes/{id}` **帶上** `score`（帳面）與 `display_score`（或等價欄；無分時 `null`／省略策略見 dream-score-flow／api-docs）。**不**新增「依分排序／過濾」專用 query API |
| 19 | 舊用語 | 產品文案用「活躍分」等；**避免**把 node score 叫作 future-sight 的 hot |
| 20 | 非法 category | Artifact（或 2a body）出現非 `mention`｜`update`｜`focus` → **不得進入／維持可 approve 的 pending**：extract 收尾校驗失敗 → **不**進 `pending_review`（錯誤態，可再 run／retry）。2a PATCH 非法 → **400**，不改 artifact |
| 21 | 幽靈 node id | Artifact 列了 live 與本場 create 皆不存在的 id → **skip＋report／log 警告**，其餘列照結算；**不**因筆誤整場作廢 |
| 22 | Pending 讀側 | `GET /dreams/pending` 回應含 **`node_score_involvements`**（陣列：至少 `id`、`category`；可選 `reason`；無 artifact／空 → `[]`），供 Consolidate／2a UI，不必只靠 parse report |
| 23 | Approve 掛點 | 分數結算實作掛在 **`approveDream`**（`server/src/dream/run.ts`）：在既有 future-sight draft maintain／autosave 之後；`empty_patches` 則跳過 `commitDraft` **與**分數；否則 `commitDraft` → **live 上** boost／downscale／新建 S0 → 將 score 路徑併入 git commit 路徑集合。細節見 dream-score-flow |
| 24 | Report 骨架 | `report-finalize.ts`：`extractNarrative` 須在碰到 `## Node score involvements` **或** `## Appendix` 處截斷（勿把 involvements 吃進 Narrative）；finalize 組裝順序：**Narrative → Node score involvements → rollup_section（若有）→ Appendix** |
| 25 | 開機結構閘 | `ensureEngramHome` 之後：磁碟 `store_version` 的 major.minor 須 **≥ 0.19**；缺鍵或過舊 → **拒啟**，訊息指向 engram-migration（`migrate-0.17-to-0.19`）。**不**要求等於 `product_version`。Escape：`ENGRAM_ALLOW_STALE_STORE=1`（警告仍啟）。細節見 [store-boot-gate.md](./docs/store-boot-gate.md) |

---

## 非目標

- Node hot／cold **區檔**或與 `future-sight/hot.md` 混名
- 日曆時間衰減；每場 dream 全體時間 scale（模型 B）
- Lazy `decay(Δt)+boost`（模型 C）當主路徑
- Seek／Ask **依分排序或種子擴張**；network 圖／節點大小
- 獨立 HTTP **只做** downscale 的公開 API（flow 程式內可呼叫；外露 → 後版）
- **2b** 自由句指示 agent 修任意 draft（→ [backlog](../backlog/dream-draft-edit.md)）
- Node merge；embedding；auth
- AI 直接寫 `score`／`max_score`
- 開機時因 `store_version !== product_version` 拒啟（同結構代較新字串須仍可啟）
- 過舊時自動改寫 `store_version` 冒充已 migrate

---

## 實作軌道（須全過；順序建議如下）

### Track 0 — 契約錨點

- **做：** 實作中若微調 artifact 檔名、report 標題、API 欄位名，先改本版 `docs/` 再改碼。
- **不做：** 把 2b 或 Seek-by-score 塞進本版。
- **驗收：** 新 agent 只讀 1–5 能說出：模型 A、三 category、新建＝S0、downscale＋`exclude_node_ids`、display 公式、2a 範圍。

### Track 1 — Store＋純 script 分數庫

- **做：** `score.yaml`／registry 讀寫；boost／downscale（含 exclude、no-op 條件）；空庫與單 node；單元或 phase 測。
- **不做：** 接 dream AI；改未來視。
- **驗收：** 不經 HTTP 可對 fixture 跑 increment＋downscale；exclude 後新建檔分數不變。

### Track 2 — Dream artifact＋report＋approve 結排

- **做：** Prompt 產 involvements artifact；`finalizeDreamReport` 插入／覆寫 `## Node score involvements`；非法 category 擋 pending；`approveDream` 掛結算（非 empty_patches：`commitDraft` → boost → downscale(exclude=creates) → 新建 S0 → git 含 score 路徑）；empty_patches／discard／retry 不動分；`GET /dreams/pending` 帶 `node_score_involvements`。
- **不做：** 2b agent edit。
- **驗收：** mock：既有加分；觸頂 exclude 新建＝S0；empty_patches approve 後分數不變；非法 category 不進 pending；pending JSON 含 involvements。

### Track 3 — 2a 結構化改 category

- **做：** `PATCH /dreams/pending/node-score-involvements`；同步 artifact＋finalize／覆寫 report 段；UI 用 pending JSON；非法 category → 400。
- **不做：** 自由句；改 `what.md`／chain；新增／刪 involvement 列。
- **驗收：** 改完未 approve 前 live score 不變；approve 後依**改後** category 結算。

### Track 4 — Memory／browse 展示

- **做：** nodes index／detail 回傳並顯示 `display_score`（及契約所定帳面欄）；i18n。
- **不做：** 依分排序控件（可後版）；未來視 UI 混入活躍分。
- **驗收：** 有 registry 時列表可見 1–100；無分顯示—。

### Track 5 — Migrate＋開機閘＋出貨

- **做：** migrate 0.17→0.19；**boot gate**（見 store-boot-gate）；migration skill；`version.md`／`changelog`／api-docs／CLAUDE／workbench／domain-language；INDEX → `shipped`；backlog 本版條出貨後刪（2b 條保留）。
- **不做：** 把常數做成必配 workspace（本版寫死即可）；用 product 字串全等當閘門。
- **驗收：** 總表全勾；`test:phases`（或等價）至少覆蓋下方 scenario。

#### `test:phases` 最低 scenario（出貨前）

| # | 場景 | 期望 |
|---|------|------|
| T1 | migrate／新建 node | 有 `score.yaml`＝S0；registry max≥S0；display 可算 |
| T2 | approve 既有 node `focus` | 該 node score += 80 |
| T3 | 同 artifact 同 id 多 category | 結算用最高档 |
| T4 | 本場新建 | 結束＝S0；不吃 boost |
| T5 | 加分後 > S_max | downscale；新建在 `exclude` 仍為 S0 |
| T6 | `empty_patches` approve | live score 不變 |
| T7 | artifact 非法 category | 不進 pending |
| T8 | 2a 改 category 再 approve | 依改後档加分；改當下 live 不變 |
| T9 | 2a 未知 id | 404 `involvement_not_found` |
| T10 | discard／retry | live score 不變 |
| T11 | boot：`store_version` 0.18.x | 拒啟（無 escape） |
| T12 | boot：缺 `store_version` | 拒啟（無 escape） |
| T13 | boot：`>= 0.19` 或新建 stamp | 可啟 |
## 驗收總表

- [x] 每 node 可有 `score.yaml`；registry 有 `max_score`
- [x] 常數與三 category／boost 符合已定案；同 node max grade
- [x] 模型 A：無日曆衰減；僅 approve 結算寫分
- [x] 新建本場＝`S0`、不 boost；downscale 以 `exclude_node_ids` 跳過新建
- [x] `max_score ≤ S_target` 時 downscale no-op；空庫不除零
- [x] Display＝`ceil(score/max*100)`；UI Memory 可讀
- [x] Report：`## Node score involvements` 在 Narrative 與 Appendix 之間；server finalize 覆寫
- [x] 非法 category 不進 pending；2a 非法 → 400；幽靈 id skip＋警告
- [x] `GET /dreams/pending` 含 `node_score_involvements`；2a 可改後再 approve
- [x] `empty_patches` approve 不跑分數；discard／retry／clear-only 不改 live score
- [x] 結算掛在 `approveDream`：`commitDraft` 後寫 live score，併入同次 git
- [x] migrate 補既有 node 為 `S0`；`store_version` 0.19.0
- [x] 開機：結構代 &lt; 0.19 或缺鍵 → 拒啟＋migrate 提示；`>= 0.19` 可啟；escape hatch 可選
- [x] **無** 2b、無 Seek-by-score、無 node hot 區
- [x] 文件／version／changelog／契約同步；INDEX＝`shipped`

---

## 錨點檔案（改前必讀）

| 路徑 | 角色 |
|------|------|
| `server/prompts/dream-files.md` | Extract 義務；involvements artifact |
| `server/src/dream/run.ts` | 入夢／**`approveDream` 分數結算掛點**／pending 生命週期 |
| `server/src/dream/report-finalize.ts` | Report 組裝；本版加 Node score 段與 Narrative 截斷 |
| `server/src/store/dreams/draft.ts` | `commitDraft`／manifest／path 回滾 |
| `server/src/store/memories/nodes.ts` | Node 骨架；本版旁路 score 讀寫 |
| `server/src/store/home.ts` | ensure；新建 stamp `store_version` |
| `server/src/config.ts` ／ store-structure 模組 | 最低結構代、boot assert |
| `server/src/index.ts` | ensure 後呼叫閘門 |
| `server/src/api/memory/nodes.ts` | Browse nodes 回應形狀 |
| `server/src/api/dream.ts`（或鄰近） | approve／pending／retry／2a PATCH |
| `web/src/scenes/MemoryScene.tsx` | 展示 display_score |
| `web/src/scenes/ConsolidateScene.tsx` | Report＋2a UI（讀 pending JSON） |
| `docs/api-docs/api.md` | 出貨同步 |
| `.claude/skills/engram-migration/` | 新 hop |
| `.claude/skills/engram-workbench/SKILL.md` | 操作語意 |

---

## 開工前仍須拍板

（無。）
