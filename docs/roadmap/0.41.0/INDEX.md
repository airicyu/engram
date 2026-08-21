# 0.41.0 — 背景入夢：extract 不擋記帳／釐清

← [changelog](../../../changelog.md) · 上游：[0.40.0](../0.40.0/INDEX.md)（shipped）· 下游：[0.42.0](../0.42.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · 構想：[backlog 背景入夢](../backlog/background-dream-lock.md)

> **狀態：** **in progress**  
> 入夢 agent 仍單場跑；extract／amend 進行中 **允許** `POST /activities`、附件 upload、clarify 寫入。輸入正確性靠 **開跑時兩份凍結快照**＋**寫入鏈與清／歸檔同鎖**，不再靠全程 `409 dream_locked`。**無** store migrate；boot 仍 ≥ **0.40**。  
> **開工前仍須拍板：無。** 設計審查 H1–H3／M1–M7 已併入本 INDEX 與 HOW（見 [design-review](./docs/design-review.md)）。

## 產品句

> 入夢在背景跑的時候，人仍可記事件、答釐清；這場夢只消化開跑當下凍結的 pool 與 pending，新寫的留給下一場。同時仍只能有一場夢。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/locking-and-snapshots.md](./docs/locking-and-snapshots.md) | 何時 409、快照欄位、鎖順序、git |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何舊全域鎖多餘、失敗模式 |
| 4 | [docs/design-review.md](./docs/design-review.md) | 初審；衝突時 **INDEX 勝** |

---

## 已定案

### A. Scope 是概念，兩份快照

| # | 題 | 決定 |
|---|-----|------|
| A1 | 定義 | 本場**輸入凍結**＝開跑那一刻讀到的資料。不是「只能有一個 JSON 欄位」。 |
| A2 | Activities | 開跑時在 **`withCaptureLock` 內一次** `readPoolEntries()`，拷貝到記憶體後**立刻釋放**（禁止持鎖 await agent）。API／`DreamRunState.scope` 仍只裝 **event id**。餵 extract、**finalize report、involvements、任何 extract 後段** 的 events＝這份拷貝。**禁止**再讀 live `pool.jsonl`（含 `readPoolEntriesForScope`）。 |
| A3 | Clarify | 在 **`withClarifyWriteLock` 內**讀完當時 `clarify/pending`（id＋正文），拷貝後釋放。另存釐清 scope；**禁止**把 clarify uuid 塞進 event `scope[]`。Distill **只**用這份正文，**禁止**末尾 `listPendingIds()` 或再讀 live pending。 |
| A4 | 新寫入 | extract 中途的 activity／aside／submit **不進**本場；留給下一場。Approve：pool 只刪 activities scope 內 id；clarify 只歸檔釐清 scope 內、且仍在 pending 的 id（缺檔跳過）。 |
| A5 | Generate | 末尾寫的 `asking/` 是本場**產出**，不是輸入 scope。Pipeline 寫／刪 live `memories/clarify/**`（generate、失敗 rollback `deleteAskingFile`）必須進 `withClarifyWriteLock`，與人的 aside／submit／dismiss 排隊。Rollback **只**刪本 job 已寫的 asking id，不刪使用者另寫的檔。Distill 只讀 sidecar，不必為讀而持鎖。 |
| A6 | Retry／persist | 快照正文**固定**寫 `dreams/runs/{id}.input.json`（`pool_snapshot`＋`clarify_snapshot` 全文）。yaml 只留 `scope`／`clarify_pending_snapshot_ids` 等 id。Retry 只讀該 json＋yaml，**禁止**重掃 live pool／pending。Amend 不重拍；agent 可讀範圍＝原 sidecar，禁止重掃。 |
| A7 | 空 pool | 用這份 pool 快照 `length===0`（加既有 rollup-only 規則），不要另 `wc -l` 打檔。 |

### B. Agent 讀什麼

| # | 題 | 決定 |
|---|-----|------|
| B1 | Extract／distill／rollup | 輸入側只用凍結 JSON／快照＋ draft／report。**禁止**讀 live `memories/short-term-memory/pool.jsonl`、`memories/activities/events.jsonl`、本場釐清 scope 外的 live `clarify/pending`。Prompt 寫明；dream／distill runner 的可讀範圍須硬限制（不要只靠模型自律）。 |
| B2 | L2 | 仍可 Read live nodes／chain／future-sight。Approve 前仍不可寫 live `memories/**`（0.20）。 |
| B3 | Ask | **不**改：Ask 仍讀 live pool（人剛記的帳應問得到）。 |

### C. 鎖分層與 HTTP

| # | 題 | 決定 |
|---|-----|------|
| C1 | 單場 | 同時只准一場 extract／retry／amend。已有 pending → `POST /dreams/run` 仍 409 `pending_review`。extract 進行中再 run／retry／amend／approve／discard → 409 `dream_locked`。 |
| C2 | 不再 409 | extract **以及** deploy 期間：`POST /activities`、`POST /attachments/uploads`、clarify aside／submit／dismiss **不得**因 `dream.lock`／`status.lock` 回 `409 dream_locked`。 |
| C3 | Capture 鏈 | **讀** pool 快照、**清** `clearShortTermMemoryScope`、append L0＋pool，皆須進現有 `withCaptureLock`。讀完拷貝即可放，勿包整場 extract。 |
| C4 | Clarify 鏈 | **讀** pending 快照、**寫** generate／rollback asking、**歸檔** `archivePendingToHistory`（及 approve 任何改 `memories/clarify` 的步驟）皆須進 `withClarifyWriteLock`。 |
| C5 | 鎖順序 | 同一函式若兩把都要：先 `withCaptureLock` 再 `withClarifyWriteLock`，避免死鎖。 |
| C6 | Deploy／git | `commitDirtyMemorySnapshot` 與任何 `git add` 含 `memories/activities`、`short-term-memory`、`clarify` 的 commit，必須在對應寫入鎖內執行（可短持兩把，順序同 C5），避免掃到半份 JSONL／md。 |
| C7 | Run mutex 實作 | 可繼續用 `dream.lock` 貫穿 extract（禁第二場夢）。**不**再用它擋 C2 那些端點。 |
| C8 | Auto-approve | 0.39 預設成功後立刻 approve：人最多在 deploy＋git 感到 **排隊延遲**（請求仍 201，不是 409）。UI 不得把「送出後稍晚才出現在時間軸」當成失敗。Integration 須能忍受 capture 鎖延遲，**不要**對 extract 中的 201 做 `dream_locked` backoff。 |

### D. UI 與 status

| # | 題 | 決定 |
|---|-----|------|
| D1 | 發帖／釐清 | **不要**用 `status.lock` 或「正在入夢」禁用 composer／aside／submit。Job 跑著仍可寫。 |
| D2 | 沉澱頁 | 仍禁用「再入夢」；approve／discard／retry／amend 在 job `running` 或 lock 且非 pending 可審時維持禁用（單場規則）。 |
| D3 | `GET /status.lock` | 語意可仍＝`dream.lock` 是否存在（extract 中可能為 true）。契約文件註明：**lock true ≠ 不可 capture**。UI 跟 D1／D2。Sidebar／`advice.lock` **不可**再暗示「不能記帳」。 |
| D4 | 錯誤文案 | 若仍收到 `dream_locked`，只應出現在「第二場夢／審核撞上正在跑的 job」。改 i18n：`activities.lock_hint`／`clarify.locked` 等不得在「僅 extract 進行中」當發帖失敗理由。 |

### E. Store／版本

| # | 題 | 決定 |
|---|-----|------|
| E1 | Migrate | **無** hop；boot 仍 ≥ **0.40**。快照存在 `dreams/runs/`（本就不進 store git 的 memories 契約）。 |
| E2 | 舊 pending | 無 `input.json`（無釐清正文快照）：**不要** `listPendingIds()`／列 pending 目錄。yaml 若無 `clarify_pending_snapshot_ids` → 視為**空**釐清快照、本場 **不**蒸餾。若**只有 ids、無正文**：對每個 id `readFile` 該 pending 檔（缺檔當該則跳過）。升級當下新 aside 不得因目錄列舉進入舊夢。本版之後新 run 必須有 `input.json`。**不要**抬 boot／寫 migrate。 |

---

## 非目標

- 同時兩場 dream／兩份 pending
- Agent approve 前寫 live `memories/**`
- 把中途新事件／新釐清自動併進本場
- 多進程寫同一記憶庫
- 改 Ask 讀取範圍、改記憶鏈 UI、vector、node merge
- 改 `scope[]` 元素型別去裝 clarify id

---

## 實作軌道

### Track A — 快照與 pipeline

- **做：** 開跑在對應鎖內讀 pool＋pending 並拷貝；`input.json` persist；context／distill／report／involvements 只用快照；retry 讀 sidecar；generate／rollback／archive 進 clarify 鎖；clear pool 進 capture 鎖；git 觸及那些路徑時持對應鎖。
- **不要做：** 末尾重掃 pending；retry 重掃 live pool；report 再 `readPoolEntriesForScope`。
- **驗收：** 單元測試：快照後 append 的 pool 行不進 context／report；distill 看不到快照後的 aside。

### Track B — HTTP 409 與 agent 可讀範圍

- **做：** 從 activities／attachments **upload**／clarify 寫入拿掉 `isLocked()→409`（**不要**改 DELETE tmp）。Dream／distill runner 禁止讀 B1 所列 live 路徑。同步 `docs/api-docs/api.md`、AGENTS、domain-language、workbench skill、**engram-activities-integration**（刪「extract 中 409 backoff」）。改寫 `self-test.ts` 裡 lock 時 capture／aside 的 409 assert。
- **不要做：** 拿掉 run／approve 的 409；讓 Ask 讀不到 live pool；改 DELETE tmp 的 lock 行為。
- **驗收：** phases：extract 進行中 `POST /activities` 與 **upload** → 201；再 `POST /dreams/run` → 409；**不再** assert capture／aside 於 lock 時 409。

### Track C — UI

- **做：** Activities／Clarify 不因 lock／dreaming disable 寫入。改 i18n／Sidebar／`advice.lock`：lock true 不表示不能記帳。Consolidate 再入夢／審核按鈕仍守單場。送出成功後池更新稍慢不當失敗。
- **驗收：** 入夢中可發帖；沉澱頁不可再開第二場。

---

## 驗收

- [x] Extract 中 `POST /activities` → **201**，該 event **不**在本場 `scope`；approve 後仍在 pool
- [x] Extract 中 `POST /attachments/uploads` → **201**
- [x] Extract 中 clarify aside → **201**；本場 distill／approve 歸檔不含該 id
- [x] Extract 中再 `POST /dreams/run` → **409** `dream_locked` 或 `pending_review`（視是否已落地 pending）
- [x] `clearShortTermMemoryScope` 與 append 交錯：新行不會被清 S 蓋掉
- [x] Dream mock／phases：context／report events 等於開跑快照，不是後來的 pool
- [x] 舊 pending 無 `input.json`：distill 不因 live 新 aside 而變（E2）
- [x] Generate 失敗 rollback 不刪使用者另寫的 asking
- [x] `test:phases` **不再** assert lock 時 capture／aside 409；全綠
- [x] UI：入夢中事件頁可發帖、釐清可寫；lock 文案不說不能記帳
- [x] api.md／AGENTS／domain-language／workbench／**activities-integration** 已寫 extract 不擋 capture
- [x] 出貨時 `version.md`／changelog 標 0.41.0；boot 仍 ≥0.40

## 與上一版對照

| | 至 0.40 | 0.41 |
|--|---------|------|
| Extract 中 activities／clarify／upload | 409 `dream_locked` | 允許；不進本場快照 |
| Distill 輸入 | 末尾 `listPendingIds()` | 開跑 pending 快照 |
| Pool 讀取 | 先 ids 再重讀 live | 一次讀完當凍結 |
| 清 pool vs append | 清 S 不在 capture 鎖 | 同一 `withCaptureLock` |
| 同時兩場夢 | 禁止 | 禁止（不變） |

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/store/dreams/lock.ts` | run／deploy 檔案鎖 |
| `server/src/store/memories/capture.ts` | `withCaptureLock` |
| `server/src/store/memories/short-term-memory.ts` | pool 讀寫／清 scope |
| `server/src/store/memories/clarify.ts` | pending 讀寫／archive／`withClarifyWriteLock` |
| `server/src/dream/execute/pipeline.ts`、`context.ts` | 何時讀 pool／distill |
| `server/src/dream/review/approve.ts` | 清 S、git、歸檔 |
| `server/src/api/activities.ts`、`clarify.ts`、`attachments.ts` | 拿掉 extract 409 |
| `server/src/agent/shared/write-policy.ts`、`server/prompts/dream-files.md` | 可讀範圍 |
| `web/src/scenes/ActivitiesScene.tsx`、`ClarifyScene.tsx`、`ConsolidateScene.tsx` | lock UI |
| `web/src/lib/types.ts`、`web/src/i18n/*` | `advice.lock`／lock_hint 文案 |
| `.agents/skills/engram-activities-integration/` | 刪 extract 中 409 backoff |
| `server/src/cli/self-test.ts` | 改 lock×capture 409 段 |
| `docs/api-docs/api.md` | `dream_locked`／pending_review 表 |
