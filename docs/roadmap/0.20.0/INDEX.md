# 0.20.0 — 正確性加固＋結構重構（多 Phase）

← [changelog](../../../changelog.md) · 上游：[0.19.0](../0.19.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（Phase 0–9 完成；2026-08-02）  
> 來源：0.19 出貨後 code review；其後依「按用途分組」整理 `agent/`、`dream/`、`api/`。  
> 性質：**產品語意大致不變**的正確性與可維護性版；**不**改記憶庫結構世代（無需 migrate）。  
> 產品版字串：**`0.20.0`**。

## 產品句

> 入夢／Ask／Rollup 的 agent **不能**在 approve 前改寫 live `memories/**`；dream lock 只可由持有者釋放；activities 並發寫入不再撞 ID 或留下半套 short-term；「叫 agent」收成 generic flow＋providers；dream 業務與 **HTTP `api/`** 皆按產品域／lifecycle 分夾，目錄直觀。每一 Phase 完成都必須通過該 Phase 的測試閘門。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [CLAUDE.md](../../../CLAUDE.md) | 操作邊界；出貨時若措辭有變須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Phase／Track、驗收總表 |
| 2 | [docs/phase-gates.md](./docs/phase-gates.md) | **每 Phase 結束必跑的測試閘門** |
| 3 | [docs/correctness-hardening.md](./docs/correctness-hardening.md) | Agent sandbox、owner lock、capture 原子性（HOW） |
| 4 | [docs/server-structure.md](./docs/server-structure.md) | Dead code、拆分邊界、agent factory（Phase 4） |
| 4b | [docs/agent-flow.md](./docs/agent-flow.md) | Phase 7：generic Invoker、`agent/` 樹 |
| 4c | [docs/dream-layout.md](./docs/dream-layout.md) | Phase 8：`dream/` lifecycle 目錄 |
| 4d | [docs/api-layout.md](./docs/api-layout.md) | **Phase 9：** `api/` 按產品域分組、拆 dream handlers |
| 5 | [docs/web-and-contracts.md](./docs/web-and-contracts.md) | Ask job hook、Memory／Consolidate、typed client |
| 6 | [docs/reasoning.md](./docs/reasoning.md) | 動機、否決項 |
| 7 | [0.16 dream-file-pipeline](../0.16.0/docs/dream-file-pipeline.md) | 現行 draft→approve |
| 8 | [0.19 INDEX](../0.19.0/INDEX.md) | 分數／boot gate；本版不改 |

**讀完 1＋4c＋phase-gates Phase 8 即可開工 Phase 8**；Phase 0–7 勿重做除非回歸失敗。  
**不可開工條件：** 無。

**強制節奏：** 依 Phase 順序；Phase 8 內部依 [dream-layout.md](./docs/dream-layout.md) Step A→E。

---

## 與 0.19 對照

| 題 | 0.19 | 0.20 |
|----|------|------|
| 產品功能面 | Node score、2a、boot gate ≥0.19 | **不變** |
| Agent 寫入範圍 | 整庫可寫風險 | Write 僅 draft／report／契約 temp（Phase 1） |
| Dream lock | 無條件 release | owner token（Phase 2） |
| Capture | `wc -l` 競態 | 原子 capture＋`node_refs` 驗證（Phase 3） |
| Server 結構 | god `run.ts`、dead materialize | 拆分＋factory（Phase 4） |
| Agent 呼叫 | ask／dream／rollup **各寫一套** Claude／Cursor spawn | **共用** `AgentInvoker`＋providers；業務只 gather／交付（Phase 7） |
| `agent/` 目錄 | 根目錄平鋪多檔 | `flow/`／`providers/`／`shared/`／`dream|ask|rollup/`（Phase 7） |
| `src/dream/` 目錄 | Phase 4 拆檔後仍平鋪 | lifecycle 子目錄（Phase 8） |
| `src/api/` 目錄 | `dream.ts` god＋分類不一致 | `dream/`／`seek/`／`memory/`＋根目錄 system／activities（Phase 9） |
| Web | Scene 內輪詢等 | useAskJob／stale guard／engramApi（Phase 5） |
| Store 結構代 | ≥0.19 | **不 bump**；無 migrate |
| Product version | `0.19.0` | `0.20.0` |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版性質 | **正確性＋結構重構**；產品循環與人審閘門 **保留**。禁止借機做 2b、Seek-by-score、node merge |
| 2 | Store／migrate | **不**變更磁碟記憶佈局；**無** `migrate-0.19-to-0.20`；boot 最低代仍 **≥ 0.19** |
| 3 | Product version | `version.md`＝**0.20.0**；新建 stamp 可為產品字串；**勿** boot 要求 `=== 0.20.0` |
| 4 | Phase 閘門 | 每 Phase 結束跑 [phase-gates.md](./docs/phase-gates.md)；失敗禁止帶債前進 |
| 5 | Agent 讀 vs 寫 | 可 Read live `memories/**`；approve 前禁止 Write live／workspace／`.git`；可寫 draft／report／Ask·Rollup 契約路徑 |
| 6 | Sandbox 實作策略 | runner 能力限制＋write-policy；Mock 遵守同一可寫根 |
| 7 | 涵蓋的 agent | Dream、Rollup、Ask 皆須符合寫入政策 |
| 8 | 驗收方式（sandbox） | 自動化：惡意寫 live → live 不變 |
| 9–11 | Lock | owner token；release／cancel／finally 只釋本作業；stale 可 break；本版無強制 heartbeat |
| 12–14 | Capture | 臨界區內唯一 ID；成功則 L0＋pool 一致；`node_refs` 非 `string[]`→400 |
| 15–17 | Phase 4 結構 | 刪 dead materialize；拆 `dream/run`；`ENGRAM_AGENT` 集中 factory |
| 18 | Approve journal | **不做** |
| 19–21 | Web | ask cleanup／resume；Memory 無 updater-fetch；endpoint client（無強制 Zod package） |
| 22 | 測試形態 | 可重複命令；可開始拆 self-test，不要求一次拆完 |
| 23 | 文件出貨 | 各收尾 Phase 完成後修訂 changelog 同節；INDEX → `shipped` |
| 24 | Generic agent flow | 抽出 **`AgentJob`＋`AgentInvoker`**：domain 負責 gather、選／render prompt、約定 `writePolicy` 與 `requireFiles`、讀檔／parse／業務後處理；**Claude／Cursor 只實作 Invoker**（CLI argv）。stdout **不當** deliverable |
| 25 | Flow 邊界 | Generic **不含** dream cascade／approve／score／ask job 狀態機／involvements。詳見 [agent-flow.md](./docs/agent-flow.md) |
| 26 | Dream 交付 | Dream 的 `requireFiles` 至少含 report；**不**要求 generic 枚舉整棵 draft |
| 27 | `agent/` 目錄 | 完成後按 **`flow/`、`providers/`、`shared/`、`dream/`、`ask/`、`rollup/`** 分組；根目錄僅 `factory.ts`（過渡 re-export 出貨前清掉） |
| 28 | 遷移次序（agent） | 先 invoker 行為收斂（Ask→Rollup→Dream），再搬檔；禁止只搬家不抽共用；每步可測 |
| 29 | Facade | 可保留 `createDreamRunner`／`createAskRunner`／`createRollupAgent` 為薄封裝；核心 `createAgentInvoker()` |
| 30 | `src/dream/` 目錄 | 按 **lifecycle** 分組：`execute/`、`review/`、`report/`、`score/`、`rollup/`、`shared/`、`legacy/`；根目錄僅保留薄 **`run.ts` barrel**（穩定對外 import）。詳見 [dream-layout.md](./docs/dream-layout.md) |
| 31 | dream vs agent/dream | `server/src/dream/**`＝入夢**業務編排**；`server/src/agent/dream/**`＝Dream **CLI runner**。Phase 8 **不合併**兩樹 |
| 32 | Phase 8 行為 | **只搬家＋修 import**；不改 HTTP、approve／score／rollup 語意。`store/dreams/*` 不併入 `src/dream/` |
| 33 | legacy schema | typed `Patch`／`schema.ts` 遷入 `dream/legacy/`；本 Phase 不強制刪除（若確認零執行期引用可選清） |

---

## 非目標

- Store 佈局變更、`store_version` bump、新 migrate hop
- 2b；Seek／network 依活躍分；node merge；auth
- Persisted approve journal；lock heartbeat／PID liveness
- 前後端 Zod monorepo 必達
- 重寫 UI 視覺；Consolidate admin dashboard
- 改 node score／boot 最低代
- 新產品端點／記憶層
- 重排整個 `server/src`（本版目錄重組範圍：`agent/`＋`src/dream/`；**不含**整棵 `store/`／`api/` 大搬家）
- 第三家 agent 供應商（本版僅 claude／cursor／既有 mock）
- 把 `agent/dream` 與 `src/dream` 合成單一 package
---

## 實作軌道＝Phase

細節見 [phase-gates.md](./docs/phase-gates.md)。

### Phase 0–6 — 已完成

| Phase | 主題 | 進度 |
|-------|------|------|
| 0 | 契約錨點 | done（2026-08-02） |
| 1 | Agent 寫入隔離 | done（2026-08-02） |
| 2 | Owner-aware lock | done（2026-08-02） |
| 3 | Capture 原子性 | done（2026-08-02） |
| 4 | Server 結構清理 | done（2026-08-02） |
| 5 | Web 非同步／scene | done（2026-08-02） |
| 6 | 回歸總閘（首輪） | done（2026-08-02；當時標 shipped） |

### Phase 7 — Generic agent flow＋`agent/` 目錄

- **做：** 已定案 24–29；依 [agent-flow.md](./docs/agent-flow.md) Step A→E。
- **驗收閘門：** [phase-gates § Phase 7](./docs/phase-gates.md#phase-7--generic-agent-flow目錄)。
- **進度：** done（2026-08-02；Step A–E；G7.1–G7.8）

### Phase 8 — `src/dream/` lifecycle 目錄

- **進度：** done（2026-08-02；Step A–E；G8.1–G8.7）

### Phase 9 — `src/api/` 產品域目錄

- **做：** 依 [api-layout.md](./docs/api-layout.md) 拆 `dream.ts`、遷 future-sight／short-term 至 `memory/`；HTTP 契約不變。
- **驗收：** `test:phases` 全過（2026-08-02）。
- **進度：** done

---

## 驗收總表

### Phase 0–6（已勾）

- [x] Agent（dream／ask／rollup）approve 前無法寫 live `memories/**`
- [x] Lock owner 不符不刪；舊 finally 不誤殺新 lock
- [x] 並發 capture 無重複 id；成功時 L0 與 pool 一致
- [x] 非法 `node_refs` → 400
- [x] Dead materialize 已移除
- [x] `ENGRAM_AGENT` 集中 factory
- [x] `dream/run` 職責已拆；HTTP 契約無破壞
- [x] Seek ask：unmount 停輪詢；可 resume／cancel
- [x] Memory：無 updater 內 fetch；有 stale guard
- [x] 無新 migrate；boot ≥0.19；產品版 0.20.0
- [x] Phase 0–6 閘門曾通過
- [x] 首輪 `test:phases`／web build／文件同步（Phase 6）

### Phase 7

- [x] 存在共用 `AgentInvoker`（Claude／Cursor）；業務路徑不再各維護一份完整 CLI argv 複製
- [x] Ask／Dream／Rollup 皆經 invoker（或等價薄 facade→invoker）
- [x] `agent/` 目錄符合 flow／providers／shared／dream｜ask｜rollup；根目錄無平鋪雜訊
- [x] write-policy／sandbox 行為不回退（G1 類測試仍過）
- [x] `bun run test:phases` 全過；相關 unit 過
- [x] changelog 0.20.0 節已補 Phase 7（當時曾標 shipped）

### Phase 8（已勾）

- [x] `dream/` 含 `execute/`、`review/`、`report/`、`score/`、`rollup/`、`shared/`、`legacy/`（或文件等價名）
- [x] 根目錄僅薄 `run.ts`（無大量平鋪業務檔）
- [x] HTTP／dream 主路徑行為不回退（`test:phases`）
- [x] `agent/rollup` 等 import 已指向新 cascade 路徑（或經 barrel）
- [x] changelog 已補 Phase 8；INDEX＝`shipped`

### Phase 9（已勾）

- [x] `api/dream/` 含 run／review／involvements／events／job；無根目錄 `dream.ts` god
- [x] `api/memory/` 含 chain／nodes／future-sight／short-term-memory
- [x] 根目錄僅 activities／status／clock（＋子目錄）
- [x] `test:phases` 全過；HTTP 契約不變

---

## 錨點檔案

見各 Phase docs（agent-flow／dream-layout／api-layout）。

---

## 開工前仍須拍板

（無。）
