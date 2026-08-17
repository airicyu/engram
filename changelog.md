# Changelog

## 0.37.0 — 記憶節點 network graph (2026-08-17)

Memory **節點**模式改為可縮放、可拖的 2D force-directed 圖；新增唯讀 `GET /memories/nodes/graph`。邊來自 L2 `{id}.md` 內 P1 wikilink。**不**改記憶鏈 UI／API。**無** store migrate；boot 仍 ≥0.36。見 `docs/roadmap/0.37.0/`。

### Added

- `GET /memories/nodes/graph`：`nodes[]` 與 index 同形；`edges[]` 含 `refs`／`level` 1–10
- Workbench 節點模式：圖取代列表；篩選 dim 非命中；點選仍走 `GET /memories/nodes/{id}` 與 `#/memory/nodes/{id}`

### Non-goals

- 記憶鏈橫向 strip、寫 `graph/links.yaml`、掃 chain 當邊、3D、新 migrate hop

---

## 0.36.0 — Workbench 左欄殼＋事件 timeline＋提問郵箱 DM (2026-08-17)

工作台改為左欄四項＋右欄內容。事件頁為發帖＋近期 STM 帖＋沉澱 tab。釐清改 DM 式收件箱。搜索與記憶內頁不改。**不**改 HTTP／dream。**有** store migrate：`0.28.x–0.35.x` → `0.36.0`（刪 chain `initialized_*.yaml` 與 STM `summary.md`／`nodes/`）；boot gate **≥ 0.36**。見 `docs/roadmap/0.36.0/`。

### Changed

- 廢 Topbar 橫向場景 tab；左欄 **事件／搜索／提問郵箱／記憶**（EN Events／Search／Inbox／Memory）
- `#/consolidate` 仍可用：開事件頁並選中沉澱 tab；左欄「事件」在 `activities` 與 `consolidate` 皆為選中
- 發帖卡：插圖 widget 在輸入下，Post 在右下；近期 feed 逐則 `GET /memories/short-term-memory` `entries[]`
- ClarifyScene：左會話列表＋右作答；aside 留在本頁
- Boot gate：`REQUIRED_STORE_STRUCTURE` → **0.36**
- `engram-migration`：`migrate-0.28-to-0.36`（離線；不丟 pending）

### Non-goals

- 記憶鏈橫向／node graph、改 Seek／Memory 內頁、改 dream HTTP

---

## 0.35.0 — 附件圖＋短期記憶只留 pool records (2026-08-17)

Workbench 把精確的 `![[_attachments/uploads/{day}/{filename}]]` 渲成圖片。短期記憶磁碟只保留 `pool.jsonl`；`GET /memories/short-term-memory` 回 `entries[]`。**無** store migrate；boot gate 仍 ≥0.28。見 `docs/roadmap/0.35.0/`。

### Changed

- `preprocessAttachmentEmbeds`＋`MdBlock`：精確附件 embed → `<img>`
- `.md-block img` 限制寬度、圓角
- STM：停止寫 `summary.md`／`nodes/*/notes.md`；啟動或寫入時刪殘檔（空 pool 則先從 legacy summary 遷進 pool）
- `GET /memories/short-term-memory`：`{ entries, present }`；廢 `summary`／`node_notes`
- Search `l1`：命中的 pool records；廢 L2 `match_reason: l1_note`
- Dream context 刪 `l1.node_notes`（`l1.summary` 僅記憶體內拼出）
- Activities 依 entries 逐則顯示；Ask prompt 只列 `pool.jsonl`

### Breaking

- GET short-term／Search `l1` 不再回 markdown `summary` 或 `node_notes`

### Non-goals

- 新附件 API、capture／WYSIWYG、alias embed
- 完整 Twitter／post UI、改 pool schema、migrate／boot gate

---

## 0.34.0 — Ask 廢 `include_later`：恆可讀 later (2026-08-15)

Seek Ask 不再讓人勾選「含較遠未來視（later）」：從 **API／job／prompt／UI** 拿掉 `include_later`。每次提問 agent 都可讀 `hot.md` 與 `later.md`，自行判斷要不要用。**無** store migrate；boot gate 仍 ≥0.28。見 `docs/roadmap/0.34.0/`。

### Changed

- `POST /memories/ask` body **僅** `q`；出現 `include_later` 鍵 → **400** `include_later_removed`
- 202／GET job **不再** echo `include_later`；prompt 兩檔都在 store map
- Seek Ask 移除 later 勾選；導語不再提須另行勾選
- mock／phases：預設 job 可引用 later zone

### Non-goals

- Search scope、hot／later 分桶與 window、dream、migrate／boot gate、兩段式 Ask

---

## 0.33.0 — Workbench UI：釐清貼文串＋記憶鏈／節點瀏覽重排 (2026-08-13)

純 **Web UI／版面**重構：釐清改貼文＋留言展開作答；記憶鏈左欄外卡＋每列三內卡、右欄整塊 detail 卡；節點左欄「搜尋使用者」列；全站加寬與統一細捲軸（無箭頭）。**不**改 API／store／dream；**無** store migrate；boot gate 仍 ≥0.28。見 `docs/roadmap/0.33.0/`。

### Changed

- ClarifyScene：asking＝貼文列；留言圖示展開回覆；`clarify.lead` 含「釐清」；aside 對齊發文框
- Memory 記憶鏈：左欄加寬／外卡／flex 每列 3 內卡／多行 preview；右欄外卡包住標題＋meta＋正文（`md-block` 去內卡殼、紙灰底）
- Memory 節點：people-search 列（頭像、`@handle`、bio、活躍分）＋列間距；篩選框覆寫瀏覽器預設邊框
- `.app` 最大寬 `80rem` → `100rem`；全域自訂捲軸（無上下箭頭）
- Topbar 場景序**不變**（activities → consolidate → clarify → seek → memory）

### Non-goals

- API／store／dream／prompt、migrate／boot gate、Seek 提前、Activities／Seek composer、graph／vector

---

## 0.32.0 — Activities `@` mention composer（廢 `node_refs`）(2026-08-13)

Activities 改為 `@` mention composer；關聯真相寫入 `raw` 內嵌 token；**廢除** `node_refs`（新請求帶該鍵 → 400）。Dream 依 mentions 消歧／create；漏建僅 Structure notes 軟警告。**無** store migrate；boot gate 仍 ≥0.28。Clarify／Seek 輸入不變。

### Added

- Token：`[@label](node:{id})`（ref）／`[@label](node-create:{id})`（create）；server 解析＋校驗
- Dream context `events[].mentions`；mock 依 create seed node 主檔；漏建 → Structure notes 警告
- Web Activities：`@` popover、ref／create pill、與附件並存

### Changed / Breaking

- `POST /activities`：出現 `node_refs` 鍵 → **400** `node_refs_removed`；`mention_create_exists`／`invalid_mention_id`
- Short-term node notes 改由 raw mentions 衍生；舊 JSONL `node_refs` 讀取忽略
- api-docs／domain-language／AGENTS／activities-integration skill

### Non-goals

- Clarify／Seek composer、node rename／merge、vector mention search、歷史 migrate、graph GUI、抬 boot gate

---

## 0.31.0 — Hash 深鏈＋wikilink 可點＋chain 寫入時 node 互指 (2026-08-12)

Workbench 可用 `#/…` 深鏈場景與 Memory 選中項；`MdBlock` 把 node P1 wikilink 渲成可點連結；入夢／rollup 寫 day／higher chain 時對當時已存在的 L2 node 寫入 P1。**不做**歷史 chain backfill；**無** store migrate。

### Added

- Web hash 路由：`#/activities`｜`consolidate`｜`clarify`｜`seek`｜`memory`；`#/memory/nodes/{id}`、`#/memory/chain/{level}/{id}`；場景 tab **push**、Memory 列表換選 **replace**；空 hash 懶寫（不自動正規化）
- `preprocessNodeWikilinks`＋`MdBlock` 可選 `knownNodeIds`；P1 必轉、短連僅 known
- Dream／rollup／amend prompts：chain 正文對存在中的 node 寫 P1；mock day summary／ledger 含 P1；summary soft lint 進 Structure notes（不擋 approve）

### Changed

- domain-language／AGENTS／changelog／version；Structure notes 掃描 draft `*.summary.md`

### Non-goals

- Path router、graph GUI、vector、歷史 backfill、`@` activity mentions、刪 `node_refs`、store migrate／boot gate bump

---

## 0.30.0 — 釐清（Clarify）：補問＋順帶補充 → 入夢蒸餾進 nodes (2026-08-11)

第五場景 **釐清**＋store 三 queue（`asking`／`pending`／`history`）＋入夢末段 `clarify_distill` → `clarify_generate`。Distill 只改 draft node 主檔；approve 才進 live L2 並將快照 pending 歸檔。**無** store migrate。

### Added

- Store：`memories/clarify/{asking,pending,history}/`；`ensureClarifyDirs()`（無 migrate hop；boot gate 仍 ≥0.28）
- HTTP：`GET /memories/clarify/asking`、`POST .../submit`、`DELETE .../{id}`、`POST /memories/clarify/aside`
- Dream 末段兩 job：`clarify_distill`（draft nodes only）→ `clarify_generate`（server 落盤 asking＋git）
- `DreamRunState.clarify_pending_snapshot_ids`／`clarify_distilled_node_ids`；pending `draft_summary.clarify_distilled_node_ids`
- Report 段 `## Clarify distill`；Approve 無論 `empty_patches` 皆歸檔快照∩pending → history
- Retry 清本輪來源 asking 後重跑兩 job；Discard／Amend 不動 asking／pending
- Web：場景 id `clarify`（Topbar：activities → consolidate → **clarify** → seek → memory）；ClarifyScene；Consolidate 高亮 distill node ids

### Changed

- 產品循環：Activities → Consolidate → **Clarify** → Seek → Memory
- api-docs／AGENTS／domain-language／workbench skill／changelog／version

### Non-goals

- Badge、list pending／history HTTP、asking TTL／history GC、silent live L2、migrate hop、Seek 共用輸入、graph／vector

---

## 0.29.0 — Activity 附圖（media attachments）(2026-08-10)

Activities 捕捉附圖：tmp 上傳、拖放／貼上、media attachments UI、submit 搬檔＋server 組 appendix、對稱校驗、tmp housekeep、dream prompt 教讀寫 embed。**無** store migrate。

### Added

- `POST /attachments/uploads` — multipart 上傳圖檔至 tmp（`file` 欄位）；MIME 白名單、大小限制、路徑消毒
- `GET /attachments/file` — 附件預覽（formal／tmp）
- `DELETE /attachments/uploads/tmp` — 刪除 tmp 暫存檔（冪等）
- `POST /attachments/housekeep` — 依目錄日期清理 tmp
- `POST /activities` 擴充：`attachments[]` 陣列、精確對稱校驗、tmp→formal move、server 組 `## Attachment relationships` appendix、失敗搬回 tmp
- Config：`attachment_max_bytes`（預設 10 MiB）／`attachment_tmp_retention_days`（預設 2）
- Store：`memories/_attachments/uploads/` 正式目錄＋`tmp/` 暫存目錄；ensure 自動 gitignore tmp
- Web ActivitiesScene：textarea＋media attachments 拖放／貼上／選檔、游標插入精確 `![[path]]`、relationship 必填、刪項同步
- i18n：中英附件 UI 字串
- Dream prompt：附件讀寫教學（appendix schema、精確 embed、選材可取捨、勿 vision）

### Changed

- `Event` 型別：新增可選 `attachments` 欄位
- `ActivitiesBody`：接受 `attachments[]`
- `ensureEngramHome`：確保 `_attachments/` 目錄
- api.md／api-docs README／AGENTS.md／engram-workbench：契約與路徑更新（修正舊 `/capture`、`/dream/*`、`/memory/*` 範例）
- 根 README：Activities 附圖說明；本版連結改指向 `0.29.0`

### Non-goals

- 無 store migrate（結構 additive，舊庫不需 hop）
- 無 WYSIWYG、vision pipeline、HEIC、reuse 既有附件、graph、vector
- 無每則 activity git commit（對齊現行 approve 才 commit）

---

## 0.28.0 — Node 主檔 `{id}.md`＋結構生長圍護 (2026-08-09)

L2 node 認知主檔從 `understand/what.md` 遷到 **`memories/nodes/{id}/{id}.md`**；Obsidian vault＝**`memories/`**。Dream／amend 以 P1 wikilink 互指；finalize report 加軟校驗 **`## Structure notes`**。**有** store migrate（離線清 pending）＋boot 最低結構 **≥ 0.28**。

### Changed

- Node 主檔路徑／seed：`{id}.md` 四段骨架；廢 stub `INDEX.md`／`understand/`
- Write-policy／draft：拒絕再寫 `understand/what.md` 與 stub `INDEX.md`
- `dream-files.md`／`amend-dream.md`：路徑、vault 相對 wikilink `[[nodes/{id}/{id}|{id}]]`、Relation 須互指
- Finalize：掃 draft node → report `## Structure notes`（警告；`_None_` 若無問題）；approve **不**因缺小標／死連失敗；finalize／commit **略過並刪除** draft 內 legacy `understand/what.md`／stub INDEX
- Boot gate：`REQUIRED_STORE_STRUCTURE` → **0.28**；拒啟文案含離線 migration skill（無需先 start server）
- 預設 `dream_committed_report_retention_days`：**7**（原 30；INDEX #25）
- **Committed report TTL 預設：** `dream_committed_report_retention_days`／`DEFAULT_DREAM_COMMITTED_REPORT_RETENTION_DAYS` **30 → 7**（workspace／env 可覆寫；`-1`＝永久）

### Added

- `.claude/skills/engram-migration/migrate-0.19-to-0.28`（script＋md）：rename live what→`{id}.md`；離線 discard pending＋清 `dream.lock`；stamp `0.28.0`

### Migration

- 舊庫（0.19–0.27 結構）須離線跑 hop；**未批准 dream 會被丟棄**。見 skill 目錄。

---

## 0.27.0 — Amend-dream（pending 同稿自由句小修）(2026-08-09)

Pending review 時除 **re-dream**（`POST /dreams/retry`）外，新增 **amend-dream**：同一 `dream_run_id` 依自由句小修 draft／report。Consolidate **Revise** 二選一觸發。**無** store migrate。

### Added

- `POST /dreams/amend` — body `{ instruction, dream_run_id? }`；缺 instruction → 400 `missing_instruction`
- `server/prompts/amend-dream.md`＋`DreamCliRunner.amend`／`amendDream` pipeline（不 discard、不 wipe draft、不重跑 rollup cascade）
- Report `## Amend feedback`；失敗保留 pending／draft（`AmendFailedError`）
- Web：待審版面＝報告／involvements → `hr` → 丟棄｜修正｜批准；修正開 overlay（re-dream｜amend-dream）

### Changed

- api-docs／AGENTS／workbench：pending 動作含 amend；產品動詞 re-dream ≠ amend-dream

### Tests

- `self-test` Phase 1b2：amend 400／202、同 `dream_run_id`、report 含 Amend feedback

---

## 0.26.0 — Node API `what_current` → `understanding` (2026-08-07)

**Breaking：** 對外 JSON 鍵 `what_current` 一次改名為 **`understanding`**（語意不變＝`what.md` 整檔 standing understanding）。涵蓋 node detail、search `nodes[]`、dream `l2_current[]`。Store 路徑不變；**無** migrate。

### Changed

- Server：`readUnderstanding`／`readAllUnderstandings`；browse／search／dream context 回 `understanding`
- Web：Memory／Seek 讀新鍵
- `docs/api-docs/`／`docs/domain-language.md`／`AGENTS.md`：契約對齊 `understanding`

---

## 0.25.0 — Node standing understanding（四段骨架）(2026-08-07)

入夢寫入的 node `what.md` 改為 **standing understanding**（固定四段 `## Identity` → `## Relation` → `## Standing facts` → `## Current situation`），不再把 day chain 抄成 node 日記。事件細節仍在 chain；API 仍回 **`what_current`**（整檔；鍵名不變）。**無** store migrate；approve **不**因缺小標硬拒。

### Changed

- `server/prompts/dream-files.md`：產品分工（node／chain／future-sight）、四段骨架、`_None_`、整檔 rewrite、禁止日記 append、新建四段 seed、日記式舊檔改寫、Long-term updates 指引
- `MockOkRunner`：新建／更新 `what.md` 皆產出四段骨架（不再檔尾 append）
- `docs/api-docs/api.md`／`docs/domain-language.md`／`AGENTS.md`：`what_current`＝整檔 standing understanding

### Tests

- `self-test`：approve 後 assert `what.md` 四段標題依序存在

---

## 0.24.0 — 空 pool 入夢＝rollup-only（關帳補建）(2026-08-07)


短期記憶為空時，同一 `POST /dreams/run` 仍可跑 **只做 higher-chain rollup**（跳過 day extract）：只要磁碟上有「已結束、缺 higher、下層有內容」的 week／month／year，就 202 進 pending；反之才 409 `nothing_to_dream`（錯誤碼不變）。**無** store migrate；不新增第二個產品動作或 HTTP 動詞。

### Added

- `hasRollupCatchupWork()` — 機械 preflight（week／month／year 三階，`touchedDayIds=[]` 靠磁碟掃描）；空 pool 在 acquire lock／start job 前先擋
- `executeDreamPipeline` 空 scope 分支：跳過 `doDreamFiles`（不 spawn day extract agent）、report Narrative 標明 rollup-only；involvements 缺檔視為空（與既有校驗等價）

### Changed

- `handleDreamRun`／`runDream`：空 pool＋有 catch-up → 202 rollup-only；空 pool＋無 → 409
- `tryScheduledAutoDream`：與手動同一空 pool 規則（不再一律 skip）
- `ConsolidateScene`：移除 `l1_empty` 禁用入夢與 onDreamRun 前置擋（改信 server 409 message）
- i18n：`advice.l1_empty`／`dream.l1_empty` 改為「空但有待關帳仍可入夢」語意（中英同步）
- `docs/api-docs/api.md`：`POST /dreams/run` 空 pool 契約更新；`AGENTS.md` 操作邊界補一句

### Fixed

- 空 pool 入夢後 cascade 以 `dayIds=[]` 仍能靠磁碟掃描找到 closed 缺檔候選（語意對齊 0.11／0.21）

---

## 0.23.0 — Support Codex CLI (2026-08-06)

第三個 live agent：`ENGRAM_AGENT=codex`（OpenAI Codex CLI `codex exec`）。寫入圍籬用 `workspace-write`＋窄 `--cd`（dream／rollup → `{store}/dreams`；Ask → jobDir＋`--skip-git-repo-check`）。`exec` 不傳 `--ask-for-approval`（CLI 0.114+ 僅頂層有效；exec 預設 never）。**無** store migrate。

### Added

- `server/src/agent/providers/codex.ts` — `CodexInvoker`（唯一 Codex argv）
- `write-policy`：`codexCdRoot`／`codexAddDirs`／`codexNeedsSkipGitRepoCheck`
- Config：`codex` mode、`CODEX_BIN`／`codex_bin`
- setup-wizard 第三選項 Codex CLI

### Changed

- factory／文件：`claude`｜`cursor`｜`codex`（預設仍 `claude`）

---

## 0.22.0 — 一鍵 dev（API + UI）(2026-08-05)

根目錄 `bun run dev` 同時起 API 與 web；log 交錯時帶 `[server]`／`[web]` 前綴；任一掛掉或 Ctrl+C 則兩邊一起停。

### Changed

- `bun run dev` → `scripts/dev.sh`（並行 API + UI）
- 僅 API：`bun run dev:server`（原 `dev` 行為）
- 僅 UI：`bun run dev:ui`（不變）

---

## 0.21.0 — 排程維護（dream cleanup ＋ integration skill）(2026-08-04)

Dream staging **startup sweep**＋**in-process `Bun.cron`** 清理孤兒 draft、crash recovery、可設定 TTL；`committed` report 可 `-1` 永久保留。可選定時 auto dream（預設 off）。出貨 activities integration skill。**無** store migrate。

### Added

- `sweepDreamArtifacts()` — Recovery（孤兒 draft、幽靈 `dream-job`、stale lock）＋分層 TTL
- In-process cleanup cron（預設 `0 3 * * *`，有效 timezone）；**僅** process 內，不註冊 OS crontab
- Workspace／env 設定：`dream_staging_retention_days`（預設 **3**）、`dream_committed_report_retention_days`（預設 **30**，**`-1`＝永久**）、`dream_cleanup_*`、`auto_dream_*`
- `bun run dreams:cleanup`／`--dry-run`；`GET /status` → `dream_cleanup`、`dream_scheduler`
- 可選 **scheduled auto dream**（`auto_dream_enabled` 預設 false）
- `.claude/skills/engram-activities-integration/` — 外部系統 `POST /activities` 整合指南
- **統一設定**：除 `ENGRAM_STORE_DIR` 外，所有 config 鍵可在 `server/.env` 與 `engram.workspace.yaml` 雙邊設定（workspace 優先）

### Changed

- Extract fail 路徑補 `removeDraft`（與 materialize 一致）
- `ENGRAM_AGENT`／`PORT`／`ENGRAM_TEMP_DIR` 等原 env-only 鍵改為 workspace yaml 亦可設；`factory`／`log`／boot gate 改讀 `config`
- **高階 rollup 關帳／補建：** 開著的週／月／年硬性不寫；已結束且下層有內容卻缺 summary 的期間每次 dream 機械補候選並強制 init（週一補上週、隔數週補漏塊；month／year 同規則）

---

## 0.20.0 — 正確性加固＋結構重構 (2026-08-02)

產品語意大致不變：activities → dream → approve → memory 與人審閘門保留。加固 agent 寫入邊界、dream lock owner、capture 原子性；清理死碼與過肥編排；修好 web Ask／Memory 非同步生命週期；抽出共用 `AgentInvoker`（Claude／Cursor），Ask／Dream／Rollup 只保留業務 gather／交付；`agent/`、`src/dream/`、`src/api/` 皆按用途／產品域分夾。**無** store migrate；boot 仍要求結構代 ≥ 0.19。

### Added

- Agent **write-policy**：Dream／Ask／Rollup 可寫根僅 draft／report／契約 temp；mock 惡意寫 live 閘門測試
- Dream lock **owner token**（`dream.lock` 含 `token`；`releaseLock(token)` 不符不刪）
- 單一 `captureActivity` 寫入路徑（process mutex＋id 單調）；`POST /activities` 非法 `node_refs`（非 `string[]`）→ `400 invalid_node_refs`
- `server/src/agent/factory.ts`：集中解析 `ENGRAM_AGENT`；**`createAgentInvoker()`**
- Generic **`AgentJob`／`AgentInvoker`**（`agent/flow/`）；Claude／Cursor 僅在 `agent/providers/`
- Web：`useAskJob`（unmount 停輪詢／resume／cancel）；`engramApi` endpoint client

### Changed

- Claude／Cursor runners：不再以整庫可寫為預設；Claude **不給 Bash**；Cursor dream 不對整庫 `--yolo`＋`--add-dir store`；**Cursor OS `--sandbox` 預設 `disabled`**（隔離靠 write-policy；`ENGRAM_CURSOR_SANDBOX=enabled` 可選）
- 刪除 dead `materializeDraft`／`appendMaterializeDraft`
- Memory scene：禁止 setState updater 內 fetch；chain／node 載入有 AbortController
- **`agent/` 目錄**：`flow/`｜`providers/`｜`shared/`｜`dream/`｜`ask/`｜`rollup/`；根目錄僅 `factory.ts`；Ask／Dream／Rollup 共用 Invoker（stdout 不當交付）
- **`src/dream/` 目錄**（lifecycle）：`execute/`｜`review/`｜`report/`｜`score/`｜`rollup/`｜`shared/`｜`legacy/`；根目錄僅薄 `run.ts` barrel（對外 import 穩定）；與 `agent/dream`（CLI）分離
- **`src/api/` 目錄**（產品域）：`dream/{run,review,involvements,events,job}`｜`seek/`｜`memory/{chain,nodes,future-sight,short-term-memory}`；根目錄僅 `activities`／`status`／`clock`；拆掉原 `dream.ts` god file

### Non-goals

- Store 佈局／`store_version` bump／新 migrate；2b；Seek-by-score；node merge；approve journal；視覺大改；第三家 agent 供應商；合併 `agent/dream` 與 `src/dream`

### Migrate

- **無**；既有 ≥0.19 庫可直接用 0.20 server；新建 stamp 可為產品字串 `0.20.0`（同結構代多字串仍可啟動）

---

## 0.19.0 — Node 活躍分（score）＋人審 category (2026-08-01)

每個 L2 node 有可觀察的活躍帳面分（模型 A：有結算的 dream 才加減，無日曆衰減）；入夢 AI 只判 `mention`｜`update`｜`focus`，script 算分與觸頂 downscale；人在 Consolidate 可用結構化 API 改 category。Memory 展示 1–100 相對分。啟動時若 store 結構代低於 **0.19**（或缺 `store_version`）則拒啟並提示 migrate。

### Added

- 存檔：`memories/nodes/{id}/score.yaml`；全域 `memories/node-score-registry.yaml`（`max_score`）
- Dream artifact：`dreams/draft/{run_id}/node-score-involvements.yaml`；report 段 `## Node score involvements`（server finalize）
- `GET /dreams/pending` → `node_score_involvements[]`
- `PATCH /dreams/pending/node-score-involvements`（2a：改 artifact 已有 id 的 category）
- Browse：`GET /memories/nodes`／`{id}` 帶 `score`／`display_score`（detail 另含 `score_timestamp`）
- Migration：`.claude/skills/engram-migration/migrate-0.17-to-0.19.md`＋腳本（0.17.x–0.18.x → 0.19.0）
- **Boot gate**：`ensureEngramHome` 後檢查結構代 ≥ 0.19；escape `ENGRAM_ALLOW_STALE_STORE=1`

### Changed

- `approveDream`：非 `empty_patches` 時 `commitDraft` 後結算 live score（boost → 觸頂 downscale＋`exclude_node_ids`＝本場新建 → 新建寫 S0）並併入同次 git
- 非法 category：extract 收尾失敗、不進 `pending_review`；2a → `400 invalid_category`
- **推翻** 0.16「缺鍵／落後結構代仍可啟動」：改為拒啟＋migrate 提示（仍不要求 `store_version === product_version`）

### Non-goals

- 2b 自由句改 draft；Seek／network 依分；node hot／cold 區；公開 downscale API；日曆衰減
- 開機因 product 字串全等失敗；過舊時自動改寫 `store_version`

### Migrate

- **有**：既有 node 補 `score.yaml`＝S0；建 registry；`store_version` → `0.19.0`
- 未 migrate 的 0.17／0.18 庫：**無法**用 0.19 server 啟動（除非 `ENGRAM_ALLOW_STALE_STORE=1`）

---

## 0.18.2 — Rollup file deliverable（不靠 stdout）(2026-08-01)

### Changed

- **Rollup plan／write**：改為 Ask／dream 同款 **寫檔再讀** — plan 寫 temp `plan.json`；writer 寫 draft 下對應 `*.summary.md`；server 讀檔驗證後 upsert manifest。`-p` 只負責驅動作，**不**再 parse stdout 當 deliverable
- Claude rollup CLI：`--allowedTools Read,Write`；Cursor 另 `--add-dir` draft root

### Migrate

- **無**；不要求 bump `store_version`

---

## 0.18.1 — Rollup agent 跟隨 ENGRAM_AGENT (2026-08-01)

### Fixed

- **`pickRollupAgent`**：預設／`ENGRAM_AGENT=claude` 時改走 `ClaudeRollupAgent`；僅 `cursor` 才用 Cursor CLI（先前非 mock 一律強制 Cursor，與 dream／ask 不一致）

### Migrate

- **無**；不要求 bump `store_version`

---

## 0.18.0 — Seek 納入未來視 ＋ window 預設 365 日 (2026-07-31)

Seek 讀側閉環：Search 可掃未來視（hot＋later）；Ask 預設可讀 hot，較遠 later 靠 `include_later`。未來視准入窗程式預設由 90 日改為 **365** 日（workspace／env 顯式值仍優先）。

### Added

- Search scope token **`future`**：掃 `hot.md`＋`later.md`；省略 `scope` 時預設 **`l1,nodes,chain,future`**
- Search 回應鍵 **`future_sight[]`**（含 `id`／`zone`／`anchor_*`／`content`／`match_reason`）
- Ask body 可選布林 **`include_later`**（預設 false；非布林 → `400 invalid_include_later`）；job／202 回應 echo 該欄
- Seek UI：Search 勾選 future（預設 on）；Ask「含較遠未來視（later）」綁 `include_later`（預設 off）

### Changed

- `DEFAULT_FUTURE_SIGHT_WINDOW_DAYS`：**90 → 365**（`hot_days` 仍 30）
- Ask prompt：廢「禁止讀 future-sight」總禁；預設可讀 hot、禁止 later；`include_later:true` 可讀兩檔
- Ask `sources[].kind` 允許 **`future_sight`**（建議帶 `id`＋`zone`）
- **`ENGRAM_AGENT` 預設：`cursor` → `claude`**（Cursor 仍可用 `ENGRAM_AGENT=cursor`）

### Non-goals

- Ask 兩段式自動升級讀 later；Search 的 later 專用 flag／`future_hot`／`future_later` scope
- 改分桶公式、item 格式、入夢前 maintain、強制改寫既有 workspace 的 90

### Migrate

- **無**磁碟結構 migrate；不要求 bump `store_version`
- 缺 `future_sight_window_days` 鍵的 store 啟動後有效窗變 365；要維持 90 須在 workspace（或 env）顯式設定

---

## 0.17.0 — 未來視雙區（hot／later）＋入夢前機械維護 (2026-07-29)

未來視由一錨一檔改為 **`hot.md`／`later.md` 兩整檔**；入夢前純 script 過期／出窗／重桶並 git commit；入夢 AI 維護內容後同一人審 deploy。舊 backlog「mindzone」語意＝hot 區，不另開記憶層。

### Added

- Config：`future_sight_window_days`（預設 90）、`future_sight_hot_days`（預設 30）；優先序 **workspace → 否則 env → 預設**（同 timezone）
- `maintainFutureSight`：入夢前 full＋commit；`GET /memories/future-sight` expire-only＋commit；approve 前對 draft full maintain
- Status：`future_sight_hot_count`／`future_sight_later_count`（保留 `future_sight_active_count`＝總數）
- GET 錨點帶 `zone: hot|later`；先 hot 再 later
- Migration：`.claude/skills/engram-migration/migrate-0.16-to-0.17.md`＋腳本

### Changed

- 存法：`memories/future-sight/hot.md`＋`later.md`；廢 `active/{id}.md`
- Item 格式：`## {id}`＋yaml fence（**僅** `anchor_start`／`anchor_end`）＋正文；排序近→遠；**不**存 `node_refs`／`event_refs`／`dream_run_id`／`committed_at`
- 過期與出窗 event 同 `source: system/future_sight_expired`，以 `ingest_meta.reason` 區分
- Dream prompt 強制對照兩檔做內容加減改
- Discard **不**回滾入夢前維護 commit
### Non-goals

- Seek／ask 注入未來視；獨立 mindzone；日曆／待辦 UI；強制 `hot_days < window_days`

### Migrate

- 0.16 store → 見 `.claude/skills/engram-migration/migrate-0.16-to-0.17.md`

---

## 0.16.0 — Store git 事務 ＋ 入夢改 draft 檔案作業 (2026-07-29)

記憶庫以 **local git** 做 approve 事務與歷史；入夢改為 **一套 prompt → AI 直接改 draft 檔**；廢 typed JSON patch 驅動的 extract→materialize；報告改固定結構 narrative；day summary／node `what.md` 廢 `## Current`／`## History`。

### Added

- Store **必備 git**：`ensureEngramHome` 幂等 `git init`／`.gitignore`（`tmp/`、`dreams/`、`log/`）／初始 commit；無 git → 拒絕啟動；`GET /status.store_git`
- **`ENGRAM_TEMP_DIR`**（預設 `/tmp`）：ask job 與 dream agent disposable workdir；不再寫入記憶庫 `tmp/ask/`（store `tmp/` 僅留 `clock.json` 等）
- Approve：**deletes → deploy → `git commit`**（message 含 `dream_run_id`）；失敗只還原 touched paths（禁止整庫 `reset --hard`）
- 入夢 file pipeline：`AgentRunner.dream`、`dreams/draft/{run_id}/`、ledger append sidecar、`deletes.txt`、協定 report（server 校對 Appendix）
- Migration skill：`.claude/skills/engram-migration/`（含 `migrate-0.15-to-0.16` 機械腳本）

### Changed

- Pending：以 **report＋`draft_summary`** 為主（不再回 typed `patches` 陣列）
- Day summary／`what.md`：整檔＝最新敘事；day ledger：無檔頂 `# 日期`，保留 patch metadata
- Rollup：寫入同一 draft，不再走 typed patch materialize
- Consolidate UI：展示 report；去掉 patch 計數
- Ask／dream temp：統一走 `ENGRAM_TEMP_DIR`（dream 結束後清 disposable dir；ask 仍 prune 保留最近 N 筆）
- **Week chain id**：`YYYY-Www` → **`YYYY-Www-MMDD`**（`MMDD`＝ISO 週一）；`GET /memories/chain/weeks`（及 detail）回 `start`／`end`（Mon–Sun 完整日期）；Memory UI 展示區間
- **`store_version`**：寫在 `engram.workspace.yaml`；`GET /status` 回 `store_version`＋`product_version`；缺鍵不拒啟；migrate／新建 store 才 stamp

### Removed（主路徑）

- Typed `Patch[]` → `materializeDraft` 作為入夢驅動（`patches.jsonl` 可留考古，不再寫入驅動）

### Non-goals

- 遠端 GitHub 同步；入夢直寫 live；Mindzone／node merge／DLQ UI

### Migrate

- 0.15 store → 見 `.claude/skills/engram-migration/migrate-0.15-to-0.16.md`（含 week 檔名升級為 `YYYY-Www-MMDD`）
- 已是 0.16 但 week 仍為舊 `YYYY-Www`：重跑同腳本之 week rename（幂等），或見 [`docs/roadmap/0.16.0/docs/week-id-mmdd.md`](./docs/roadmap/0.16.0/docs/week-id-mmdd.md)

---

## 0.15.0 — Server src layout + agent shared runners (2026-07-27)

Internal refactor: align `server/src` with product domains, share agent subprocess helpers, and retire **L1／L1.5** as current terminology（→ **short-term memory**／**dream staging**）. **HTTP paths and JSON wire keys unchanged**（含 `scope=l1`、`l1_empty`）.

### Changed

- **`store/`** 分組鏡像磁碟：`memories/`／`dreams/`／`tmp/`；`events`→`activities`；`l1`→`short-term-memory`
- **`api/`／業務編排**：Seek → `seek/`＋`api/seek/`；Activities short-term preview；`capture`→`activities`
- **Agent**：共用 `subprocess`／`temp-context`／`prompt-template`／envelope helper；Claude extract 與 rollup 納入 process registry（cancel 可殺 child）
- **Prompts**：`rollup-plan.md` 單一檔（原 week／month／year 三份相同內容合併）；**rollup-write week／month／year**：外層仍按 lived dimensions 分 `##`，**節內改為時間線敘事**（禁止無指涉的「這天／今日」）
- **文件用語**：`domain-language`／`AGENTS.md`／api-docs／README／workbench skill 對齊 short-term memory／dream staging

### Non-goals

- HTTP URL／JSON 欄位改名；記憶庫磁碟再搬；agent timeout；新記憶功能

---

## 0.14.0 — Store Layout Refactor (2026-07-27)

Reorganize the memory store layout and hard-cut HTTP base paths to match（未對外開放，無舊 path／env alias）.

### Changed

- Live memory under `memories/`；dream pipeline under `dreams/`；ask／clock under `tmp/`
- HTTP：**`POST /activities`**；**`/dreams/*`**；**`/memories/*`**（含 **`GET /memories/future-sight`**、**`GET /memories/short-term-memory`**）
- Disk chain：**`memories/chain/`**（不再 `memories/memory-chain/`）
- Env／status：**`ENGRAM_STORE_DIR`**（取代 `ENGRAM_HOME`）；**`GET /status.store_dir`**（取代 `engram_home`）
- HTTP listen：**API／UI／Vite 固定綁 `127.0.0.1`**（本機 `localhost` 可存取；不對 LAN 開放）
- Removed unused scaffolding：`meta.yaml`、`meta/`、`archive/`、empty dream reviews／dlq-archive、`applied.yaml`、`candidates/nodes.yaml`

### Non-goals

- New memory features；long dual-read of old disk／URL／env names

---

## 0.13.0 — Workspace Config + First-run Setup (2026-07-26)

Per-`ENGRAM_STORE_DIR` preferences plus a first-run setup wizard.

### Added

- **`{ENGRAM_STORE_DIR}/engram.workspace.yaml`** — optional `timezone` (IANA) + `memory_language` (`zh-Hant`｜`zh-Hans`｜`en`); unknown keys／invalid values → server refuses to start
- **Effective language priority:** workspace → `ENGRAM_MEMORY_LANGUAGE` → **`en`**
- **`GET /status.memory_language`** — always one of the three codes
- Prompt injection `{{MEMORY_LANGUAGE}}` for extract／rollup／memory-ask (new prose only; L0 untouched)
- **`bun run setup`** — `setup-wizard/` mini Bun server (random port, console URL, open browser); writes `server/.env`、`web/.env`、data home、workspace yaml; overwrite requires confirm (`409` then `overwrite: true`)

### Changed

- Timezone resolution: workspace overlay on `ENGRAM_TZ`／default `Asia/Hong_Kong`
- Default memory write language is explicit **`en`** when unset (intentional vs 0.12 unconstrained)

### Non-goals

- Runtime workspace settings API／Workbench settings page／hot reload
- Bare UTC offset as timezone; rewriting old L2／L0

---

## 0.12.0 — Dream Retry with Reason (2026-07-26)

Pending review is three-way only: **Approve／Discard／Retry with reason**. No more unreasoned Dream (replace).

### Added

- **`POST /dream/retry`** — `{ reason }` required; optional `dream_run_id`
- Snapshot previous draft／patches summary + frozen **scope S** → discard pending → new run on **same S** with `review_feedback` in extract context
- Report／run yaml audit: `retried_from`, `retry_reason`
- Consolidate UI: reason field + **Retry with reason**

### Changed

- `pending_review` → **`POST /dream/run` 409** `pending_review` (supersede removed)
- Extract prompt documents `review_feedback` for retries

### Removed

- UI「入夢（取代）／Dream (replace)」

### Non-goals

- Hand-edit patches／draft; multi-turn chat revise UI; Cancel semantics unchanged

---

## 0.11.0 — Week／Month／Year Memory Chain (2026-07-26)

Higher-granularity memory chain on top of day: summary-only week／month／year with planner→writer cascade inside the same dream pending review.

### Added

- **Day path grouping** — `memory-chain/days/{YYYY-MM}/{day}.md` (+ `.summary.md`)
- **Week／month／year summaries** — store layout + `initialized_{weeks,months,years}.yaml` (initialized ≠ freeze)
- **Rollup pipeline** — after day extract／materialize: week → month → year planner（Y/N）then writer → same draft／`patches.jsonl` (`level` extended)
- **Browse API** — `GET /memory/chain/weeks|months|years` (+ `/{id}`); empty → `200` + `present: false`
- **Search** — chain hits include `level` (+ `id`; day keeps `day_id`)
- **Web Memory** — Day｜Week｜Month｜Year chain browse
- **`bun run chain:backfill`** — engineering backfill of higher summaries from day chain

### Changed

- Dream report lists higher-chain rollup decisions／init／revise
- `memory-ask` prompt paths for grouped days + higher summaries
- MVP “closed = freeze” superseded by **initialized + revisable** rollup
- **Rollup writer** — prompts ask for multi-paragraph fused summary; mock／pipeline do **not** mid-cut with `…` (trust agent length judgment)
- **Higher summaries** — week／month／year keep **latest snapshot only** (whole file = markdown body; no `## Current`／`## History` wrapper)
- **Month／year writer** — organize by **life dimensions** with short content-derived `##` section titles (not a fixed Work／Family checklist; not calendar-linear tour); week may stay lightly chronological but still sectioned
- **Day chain `summary`** — may use the same `##` section titles inside Current; store still wraps `## Current`／`## History`
### Non-goals (unchanged)

- No git store transactions; no higher-level ledgers; no cron scheduler

---

## 0.10.0 — Web Vite + React (2026-07-25)

Workbench UI rewritten as Vite + React + TypeScript; shared AppShell width for all scenes.

### Changed

- **`web/`** — Vite + React + TS; scenes as components under `src/scenes/`
- **AppShell** — fixed width `min(80rem, …)` for every scene (topbar + content)
- **Dev** — `bun run dev` → Vite on `:8788` with `/api` proxy
- **Prod** — `bun run build` → `dist/`; `bun run start` serves dist + API proxy

### Removed

- Vanilla `app.js` / root `index.html` multi-section page / Bun HTML import serve path

### Unchanged

- Engram server HTTP API contracts
- Scene set: Capture → Consolidate → Seek → Memory
- i18n zh-Hant／en catalogs

---

## 0.9.0 — Time Replay (2026-07-24)

Virtual memory clock + day-by-day fixture replay (capture → dream → approve).

### Added

- **Virtual clock** — `nowIso()` / `calendarDate()` read a settable timeline; persist `ENGRAM_STORE_DIR/meta/clock.json`
- **`GET /clock`** / **`PUT /clock`** / **`DELETE /clock`** — inspect / set / clear virtual now (`PUT` requires `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`)
- **`/status.clock`** — `{ mode, now, today, timezone, allow_set }`
- Extract context + prompts: explicit **`today`** / **`now`** (also memory-ask)
- **`bun run replay`** — fixture JSONL orchestrator (per-day capture → dream night → auto-approve; `--pause` optional)
- Sample fixture: `server/fixtures/replay-sample.jsonl`
- `test:phases` Phase 6 virtual-clock assertions

### Unchanged

- Capture body still has no client `ts` — set clock first, then `POST /capture`
- Seek / Memory browse contracts

---

## 0.8.0 — Seek + Memory Browse (2026-07-24)

Split **Seek** (search／ask) from **Memory** (browse); add read-only chain／nodes browse API.

### Added

- **`GET /memory/chain`** — day index (new→old + 80-char preview)
- **`GET /memory/chain/{day_id}`** — day detail (`summary` or `ledger_fallback`)
- **`GET /memory/nodes`** — L2 node index (A→Z + preview)
- **`GET /memory/nodes/{node_id}`** — what Current detail
- Workbench **四場景**：記下／沉澱／**尋找 Seek**／**記憶 Memory**
- Memory browse UI — chain + nodes split layout (`≥48rem`); client-side node filter
- `test:phases` Phase 4c browse assertions

### Changed

- UI **Search + Ask** moved to **Seek** scene; API paths unchanged
- Memory scene width `min(56rem, …)`; other scenes stay `42rem`

### Unchanged

- **`GET /memory/search`**、**`POST /memory/ask`** contracts
- L1 preview stays on **Capture** (`GET /memory/l1`)
- No future-sight browse; no server-side node filter

---

## 0.7.0 — Memory + Ask + Dream Cancel (2026-07-23)

Rename Recall → **Memory**; keyword search with optional **scope**; async AI ask; manual dream/ask cancel.

### Added

- **`GET /memory/l1`** — Capture L1 preview (summary + node_notes only)
- **`GET /memory/search?q=&scope=`** — keyword hits only (`q` required; `scope=l1,nodes,chain` optional, default all)
- **`POST /memory/ask`** + **`GET /memory/ask/{job_id}`** + **`POST /memory/ask/{job_id}/cancel`** — async AI Q&A (`ENGRAM_AGENT=mock-ask-ok` for tests); agent reads `ENGRAM_STORE_DIR` directly
- **`POST /dream/cancel`** — cancel running dream (kill agent + revert L1.5 draft)
- **`/status` `ask_job`** — running ask summary + `log_tail`
- Workbench **Memory** scene (Search with scope checkboxes | Ask); Consolidate **Cancel** during dream

### Changed

- Product cycle UI: **Capture → Consolidate → Memory**（記憶）
- **`GET /recall` removed** (hard cut); search no longer returns activation packet / `dream_status`
- **`dream_run_id` / ask `job_id`** — compact `{prefix}-YYYYMMDD-HHmmss-{rand6}` (URL-safe); timestamps in yaml remain full ISO
- `dream-job.yaml` records **`agent_pid`** on extract spawn

### Unchanged

- No auto timeout; stale dream lock (30 min) unchanged
- `GET /future-sight` path unchanged; no future-sight UI

---

## 0.6.0 — Dream observability (2026-07-23)

Structured dream run events + default server console visibility; Workbench Consolidate progress panel.

### Added

- **`dream/runs/{dream_run_id}/events.jsonl`** — append-only structured run log (`run_start`, `agent_spawn`, `materialize_patch`, …)
- **`GET /dream/events?run_id=&after=`** — incremental event poll; `200` + empty when no file (not 404)
- **`/status` `dream_job.log_tail`** — last ≤20 events while job `running`
- Workbench Consolidate **progress panel** (phase, elapsed, scrollable log); lock poll **3s**

### Changed

- Agent spawn／finish／parse milestones **default to info** console (`logDream`); full stdout preview still `ENGRAM_DREAM_DEBUG=1`
- `dream-job.yaml` **phase updates to `materialize`** when extract finishes
- i18n keys for dream log events (`consolidate.log.*`)

### Unchanged

- Dream lock／approve／discard contract; no WebSocket／SSE

---

## 0.5.0 — Chain dual-track + Web i18n + cleanup (2026-07-22)

Memory-chain **ledger + summary** dual-track; workbench UI English／繁體中文 shell i18n; server cleanup（timezone、hot-path I/O、deps、event id）。

### Added

- **Chain summary** — `memory-chain/days/{id}.summary.md` (`## Current` / `## History`); `chain` patch fields `summary` + `summary_operation` (`init`｜`revise`)
- Extract context **`chain_summaries_current`** (+ optional `chain_ledgers`)
- Recall `chain.source`: `summary`｜`ledger_fallback`｜`empty` (prefer summary Current)
- Pending `draft_summary.chain_summary_days`
- Web **`i18n/`** — `zh-Hant`（預設）＋ `en`；topbar 語言切換；記憶內容不翻
- **`ENGRAM_TZ`**（IANA）；`/status` 欄位 **`timezone`**；extract prompt `{{TIMEZONE}}`
- `server/src/yaml.ts` — Bun 內建 YAML wrapper

### Changed

- Ledger remains `days/{id}.md` append-only; one `chain` patch drives both tracks
- Dream report timeline shows summary first; ledger increment in `<details>`
- Mock agent／`test:phases` cover dual-track
- Timezone helpers：`calendarDate`／`nowIso`（取代 `taipeiDate`／`taipeiNowIso`）；預設 **`Asia/Hong_Kong`**
- **Event id** 寬度：`e` + **10** 位（例 `e0000000001`）；`nextEventId` 以 `wc -l` 計行，不整檔 parse JSONL
- 熱路徑：DLQ count／L1 empty → `wc -l`；`patchesForRun` → `grep -F`；dream extract 事件來自 L1 scope（避免掃巨大 L0）
- 依賴：移除 npm **`yaml`**；TypeScript **~7**；`tsconfig` 去掉 deprecated `baseUrl`／`paths`
- Web status poll：lock **5s**／pending **20s**／idle **60s**
- 產品中文用語：Capture→**記下**、Consolidate→**沉澱**、Recall→**回憶**、Dream→**入夢**（`docs/domain-language.md`）
- Server 模組／主要 export 補責任註解

### Removed

- **`fixture:apply` CLI** 與 `server/fixtures/` — 機械回歸改以 `test:phases` 為主
- Hardcoded **Asia/Taipei** in runtime helpers（改為 `ENGRAM_TZ`）

### Unchanged

- No week/month rollup; no memory-content translation; no commit-time AI re-fuse
- Recall still does **not** inject future-sight

---

## 0.4.1 — Capture API rename (2026-07-22)

Unify product vocabulary: **Capture** subsumes Ingest.

### Changed

- **`POST /ingest` → `POST /capture`** (hard cut; no alias) — aligns API with UI Capture scene
- Web Capture submit button **寫入 → Capture**
- Workbench skill: `engram-api.sh capture` (replaces `ingest`)
- **L0.5 → L1.5** in domain language — intermediate layer between L1 and L2

### Unchanged

- Request body still uses **`raw`**; response still `{ "event_id" }`
- Lock rules: `pending_review` allows capture; dream lock → `409 dream_locked`

---

## 0.4.0 — Near-horizon future-sight (2026-07-22)

Independent future-sight anchors (day / short range), approved via dream; expiry marks an L0+L1 event then hard-deletes the live file. Recall (`/recall`) does **not** inject future-sight.

### Added

- **`future` patch** → `future-sight/active/{id}.md` on approve (draft-staged)
- **`GET /future-sight`** — list active anchors; lazy sweep expired
- Approve gate **`409 stale_future_anchor`** when `anchor_end` &lt; today
- `/status` field **`future_sight_active_count`**
- Extract／report: **Proposed future-sight**; far/vague foresight stays on node／day events (no new facets)

### Changed

- **`GET /activate` → `GET /recall`** (hard cut; no alias) — product vocabulary aligns with UI Recall
- Consolidate UI primary action **Extract → Dream**

### Fixed

- **`dream_run_id` uniqueness** — append entropy so two runs in the same second do not reuse patches via `appendPatchesIfNew`
### Unchanged

- Future `chain.id` still blocked (`409 future_chain_id`)
- `/recall` packet shape (no future-sight injection)

### Out of scope

- Short-term future mindzone (moving window) — backlog
- Recall injection of future-sight — backlog
- `when.md` facet, calendar sync, expiry cron

---

## 0.3.0 — Dream approve + world timeline (2026-07-21)

Human review gate before L2 writes; L1 mem pool cleared by event-id scope; memory-chain uses occurrence days.

### Added

- **`GET /dream/pending`**, **`POST /dream/approve`**, **`POST /dream/discard`**
- **L1.5 draft staging** — `dream/draft/{run_id}/` + `manifest.yaml`; `dream/runs/{id}.yaml`; reports under `dream/reports/`
- **L1 mem pool** — `short-term-memory/pool.jsonl` indexed by L0 event id; approve clears only frozen scope **S**
- **`pending_review`** status; ingest allowed while pending (blocked only under dream lock)
- **Supersede** — new `/dream/run` replaces the unique pending
- **World timeline** — `chain.id` = occurrence day; approve blocks future `chain.id` (`409 future_chain_id`)
- **`propose_node` → live node** on approve (same-run create + semantic allowed)
- Consolidate **minimal UI** — Extract / report / Approve / Discard
- Empty patches may pending; approve clears S with no L2 write

### Changed

- `POST /dream/run` = extract + materialize only (no auto-apply / no resume-apply)
- Extract input = full scope S (cross-day L0), not “today only”
- `/status` exposes `dream_pending`, `l1_clear_pending`, job `phase`

### Removed / cancelled

- Per-patch live apply as the main path; resume-apply of unapplied patches
- Candidates-as-create-node gate (attribution candidates remain for low-confidence episodic)

### Out of scope

- Node merge, full review UI, L1 capacity/forgetting
- Future-sight → moved to **0.4.0** (shipped)

---

## 0.2.0 — Web UI (2026-07-18)

Browser workbench for the 0.1.0 memory loop: **Capture → Consolidate → Recall**, without changing the memory contract.

### Added

- **`web/`** — vanilla HTML/CSS/JS workbench UI on Bun (`:8788`)
- **API proxy** — `/api/*` → `ENGRAM_URL` (default `http://localhost:8787`)
- **Capture** — textarea ingest (`source: web`), optional `node_refs`, today's L1 panel; disabled while dream lock held
- **Consolidate** — status panel + Run dream; shows applied / DLQ / resumed / 502 incomplete
- **Recall** — activate query with L1 → day chain → nodes reading layout
- **Status light** — polls `/status`; maps `lock` → dreaming

### Out of scope (unchanged)

- Auth, candidates approve UI, DLQ settlement, streaming dream logs, embeddings / graph

---

## 0.1.0 — Prototype (2026-07-18)

First runnable memory loop: **ingest → dream (extract + apply) → activate**, over a Bun HTTP API and file-backed store.

### Added

- **Bun HTTP server** (`server/`) with `ENGRAM_STORE_DIR` store layout and Asia/Taipei timestamps
- **`POST /ingest`** — append L0 event + update L1 (`today-summary`, optional node notes); rejects with `409` while dream lock held
- **`POST /dream/run`** — lock → Claude Code extract → L1.5 patches → apply → clear L1; resume apply-only when patches exist and L1 still present
- **`GET /activate`** — activation packet: L1, day chain, matched L2 `what` Current (optional `?q=`)
- **`GET /status`** — lock, L1 empty, DLQ count, `dream_status`
- **Apply mechanical layer** — patch schema, per-patch idempotency (`applied.yaml`), DLQ for failed patches, clear L1 after apply pass
- **Patch types (prototype):** `semantic/what`, `chain/day`, `propose_node`; low-confidence `episodic` → attribution candidates; high-confidence episodic not applied yet
- **AgentRunner** — `ClaudeCodeRunner` (headless `claude -p`) plus `mock-ok` / `mock-fail` for tests
- **CLI** — `reset`, `fixture:apply`, `test:phases`
- **API docs** — `docs/api-docs/`
- **Workbench skill** — `.claude/skills/engram-workbench` (HTTP-only control plane)

### Out of scope (prototype)

- Web / chat UI
- DLQ settlement / adhoc review API
- Candidate approve → create `nodes/{id}/` via API
- Chronology apply, week/month chain, graph links, embedding, scheduled dream
- Multi-tenant / auth

### Notes

- Validates the MVP question: ≤3 nodes + L0 + L1 + dream run (what + day + candidates + L1.5) vs full rewrite
- Clients and skills must use the HTTP API; do not edit `ENGRAM_STORE_DIR` for operational writes
