# Engram — Agent Context

本檔（AGENTS.md）是專案給 coding agent 的重要脈絡，會由 Cursor CLI／Claude Code 自動讀取。開始改碼或操作前先讀這裡。

## 語言（強制）

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**

- 用書面語，不用口語／網路腔（避免「喔」「啦」「欸」堆疊）
- 專有名詞、程式識別子、API path、檔名可保留英文原文
- 程式碼註解與 commit message：跟隨既有慣例；與使用者對話則用繁中書面語

## 這是什麼

**Engram** 是個人記憶原型：透過 HTTP API 走完 **activities → dream（draft 檔案作業）→ approve（deploy＋git）→ memory**。

| 層 | 角色 |
|----|------|
| **L0**（activities） | 唯附加事件 log（`memories/activities/events.jsonl`） |
| **short-term memory** | 短期記憶 pool（`memories/short-term-memory/pool.jsonl`）；approve 成功後按 scope S 清理 |
| **dream staging** | draft 工作樹（`dreams/draft/{run_id}/`）＋協定 report（`dreams/reports/`）；Approve 才 deploy 至 **L2** 並 `git commit`。入夢／Ask／Rollup agent **approve 前不可寫** live `memories/**`（僅 draft／report／契約 temp） |
| **L2** | **長期已沉澱記憶**＝**nodes**（主題理解）＋**chain**（時間軸）；見下行兩欄 |
| └ **nodes** | `memories/nodes/{id}/{id}.md`（整檔＝**standing understanding**；期望四段 Identity／Relation／Standing facts／Current situation；API 回 `understanding`）。Obsidian vault＝**`memories/`** |
| └ **chain** | `memories/chain/days|weeks|months|years/`（day summary＝整檔敘事；ledger＝append-only） |
| **future-sight** | 近程前瞻錨點（`memories/future-sight/hot.md`＋`later.md`）；入夢前 script 過期／重桶並 git commit；GET 懶清過期 |
| **clarify** | 釐清 queue（`memories/clarify/{asking,pending,history}/`）；非 activity；入夢末段 distill→generate；approve 歸檔 pending→history |
| **store git** | `ENGRAM_STORE_DIR` 必為 local git；追蹤 `memories/**`＋`engram.workspace.yaml`；**不**追 `dreams/`、store `tmp/` |
| **runtime temp** | `ENGRAM_TEMP_DIR`（預設 `/tmp`）：ask jobs＋dream agent disposable workdirs；不在記憶庫內 |

產品循環對齊 UI：**Activities → Consolidate → Clarify → Seek → Memory**（場景 id：`activities`／`consolidate`／`clarify`／`seek`／`memory`）。

時區由 **有效 timezone** 決定：記憶庫內 `engram.workspace.yaml` → 環境變數 `ENGRAM_TZ` → 預設 **`Asia/Hong_Kong`**。  
記憶寫入語言：workspace config `memory_language` → 環境變數 `ENGRAM_MEMORY_LANGUAGE` → 預設 **`en`**（僅 `zh-Hant`｜`zh-Hans`｜`en`）。原型無 auth。  
記憶庫結構世代：workspace **`store_version`**（semver）。**0.28+**：啟動時 major.minor 須 **≥ 0.28**，缺鍵或過舊 → **拒啟**並提示離線跑 **engram-migration** skill（hop `migrate-0.19-to-0.28`；在該 skill 目錄執行 `bun ./scripts/migrate-0.19-to-0.28.ts`；**無需先啟動 server**；未批准 dream 會被丟棄；勿手改當 migrate）；`ENGRAM_ALLOW_STALE_STORE=1` 可警告後仍啟。migrate／新建才 stamp。**結構沒變的產品版可不 bump 舊庫**，但新建仍可能 stamp 產品版 → 同形狀可有多個字串；migrate 按**結構世代**、跨代**逐 hop**——見 `docs/roadmap/0.16.0/docs/store-version.md`、`docs/roadmap/0.19.0/docs/store-boot-gate.md`、**engram-migration** `SKILL.md`。


## 倉庫結構

| 路徑 | 用途 |
|------|------|
| `server/` | Bun HTTP API（記憶核心）— 預設 `127.0.0.1:8787` |
| `web/` | Vite + React workbench UI + `/api` proxy — 預設 `127.0.0.1:8788` |
| `setup-wizard/` | 首次 `bun run setup`（static HTML + mini Bun server） |
| `docs/api-docs/` | API 說明；契約細節見 `docs/api-docs/api.md` |
| `data/` | 預設記憶庫路徑（由環境變數 `ENGRAM_STORE_DIR` 指定；勿當原始碼改） |
| `docs/roadmap/` | 版本計畫；寫法見 [`docs/roadmap/GUIDELINES.md`](./docs/roadmap/GUIDELINES.md)；多 agent／審查／HANDOFF 節奏見 [`docs/roadmap/agent-workflow.md`](./docs/roadmap/agent-workflow.md)；大功能先寫 plan、同意後再實作 |
| Agent skills | 真相：`.agents/skills/engram-*`；`.claude/skills/engram-*` 可為指向該處的 stub（Cursor／Claude 發現用） |

版本真相：`version.md`、`changelog.md`。

## 技術棧

- **Runtime：** Bun（TypeScript，ESM）
- **Server：** `Bun.serve({ routes })`
- **Web：** Vite + React + TypeScript；Bun 服務 `dist/` + proxy（prod）
- **Dream extract：** `AgentRunner`（預設 Claude Code；可切 `cursor`／`codex`／mock）

常用指令：

```bash
# 首次設定（安裝依賴 + wizard）
bun run setup

# 根目錄：一鍵或分開
bun run dev                       # API + UI（log 前綴 [server]/[web]）
bun run dev:server                # 僅 API :8787
bun run dev:ui                    # 僅 UI :8788，proxy → ENGRAM_URL

# 子專案
cd server && bun run dev          # 同 dev:server
cd server && bun run reset        # 清空記憶庫（破壞性，需確認）
cd web && bun run dev             # 同 dev:ui
```

## 操作邊界（極重要）

**操作記憶狀態時：只打 HTTP API，不要直接讀寫記憶庫下的 yaml、md、jsonl。**

| 做 | 不做 |
|----|------|
| `curl` / `engram-workbench` skill 打 API | 手改 `events.jsonl`、short-term notes、L2 `{id}.md` |
| `POST /activities` 寫入 | 把 fixture seed 當試用資料 |
| `POST /dreams/run` extract／file pipeline → pending（pending 時 409） | 未經同意就 `reset` |
| `POST /dreams/approve`／`discard`／`retry`／`amend` | 手改 short-term／L2／draft「幫忙改對」 |
| `GET /memories/search` / `GET /memories/short-term-memory` / `POST /memories/ask` / `GET /memories/chain` / `GET /memories/nodes` / `GET /status` / `GET /dreams/pending` / `GET /memories/future-sight` / `GET /memories/clarify/asking` / `POST /memories/clarify/aside` / `POST|DELETE /memories/clarify/asking/...` / `GET|PUT|DELETE /clock` | 臆測 request 欄位名（API 嚴格，錯欄位 → 400） |
| `POST /attachments/uploads` 上傳附件圖檔（multipart `file`） | 手動放檔案到 `_attachments/uploads/` |
| `DELETE /attachments/uploads/tmp?day=&filename=` 刪暫存 | 手刪 tmp 目錄 |

API 欄位提醒：

- activities body 用 **`raw`**（不是 `content` / `text`）；**不要**傳 `ts` — 要模擬過去時間先 `PUT /clock`；**不要**傳 `node_refs`（0.32 廢除 → 400）；node 關聯用 `raw` 內 `[@id](node:id)`／`[@id](node-create:id)`
- memory search query 用 **`q`**（必填）；可選 **`scope`** = `l1,nodes,chain,future`（逗號分隔，預設四者全開）
- memory ask body 用 **`q`**；可選 **`include_later`**（boolean，預設 false＝可讀 hot、不可讀 later）
- dream **retry** body 用 **`reason`**（必填）；對同一凍結 scope 重跑，注入上一輪摘要
- dream **amend** body 用 **`instruction`**（必填）；**同一** `dream_run_id` 小修 draft；失敗仍保留 pending
- dream **lock**（入夢／deploy）時 activities／clarify 寫入 → `409 dream_locked`；**`pending_review` 可寫 activities／clarify**
- clarify：aside body 用 **`raw`**；submit body 用 **`answer`**；**不**寫 L0／STM／day ledger
- **`pending_review` 時不可**再 `POST /dreams/run`（改 approve／discard／retry／amend）
- **空 pool 仍可入夢（0.24）：** short-term 空但存在已結束、缺 higher 的 week／month／year → `POST /dreams/run` 走 **rollup-only**（跳過 day extract，只跑 cascade）→ 202；若無此類 catch-up 才 409 `nothing_to_dream`
- **虛擬時鐘：** `PUT /clock` 需 `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`；`DELETE /clock` 恆可；見 `/status.clock`
- **無資料不用 404**：讀取型「目前沒有內容」回 **200**，在 body 用 `null`／`[]`／`present: false` 等表達；404 留給路徑／方法真正不存在
- **未來視窗：** 有效 `future_sight_window_days`＝workspace → env → 預設 **365**；`hot_days` 預設仍 **30**

操作技能：**engram-workbench**（`.agents/skills/engram-workbench/`）

## API 未暴露（原型）

下列需人工／未來 API，勿假裝已有端點：

- Node merge／融合（見 roadmap；另版）
- 清空 store → 僅 `cd server && bun run reset`（先確認）

（0.3：dream 可直接 create live node；契約見 `docs/roadmap/0.3.0/INDEX.md`。）

## 開發慣例

1. **先 plan 後實作**：roadmap 條目未同意前，不大改記憶契約或 patch schema。Roadmap 必須 **self-sufficient**（新開 agent 不靠對話殘留也能開工）；見 [`docs/roadmap/GUIDELINES.md`](./docs/roadmap/GUIDELINES.md) 與 [`docs/roadmap/agent-workflow.md`](./docs/roadmap/agent-workflow.md)。
2. **UI 跟記憶循環走**：是個人記憶工作台，不是 admin dashboard；不要首屏塞 stats／多欄卡片牆。
3. **最小改動**：只改任務需要的檔案；不順便重構、不亂加 markdown 文件。
4. **契約文件優先**：改 API 行為時同步 `docs/api-docs/`；改版本時更新 `version.md` / `changelog.md`。
5. **測試資料**：`bun run test:phases`（isolated `data-test/`）僅機械自測；真人試用走空 store + activities。

## 目前版本脈絡

- **已出貨：** `0.32.0` — Activities `@` mention composer＋raw token 真相＋廢 `node_refs`；見 `docs/roadmap/0.32.0/`（**shipped**；**無** store migrate）
- **上一版：** `0.31.0` — Hash 深鏈＋MdBlock wikilink 可點＋chain 寫入時 node 互指（**不**回填歷史）；見 `docs/roadmap/0.31.0/`（**shipped**；**無** store migrate）
- **更早：** `0.30.0` — 釐清（Clarify）：補問＋順帶補充 → 入夢蒸餾進 nodes — 見 `docs/roadmap/0.30.0/`（**shipped**；**無** store migrate）
- **更早：** `0.29.0` — Activity 附圖（media attachments）— 見 `docs/roadmap/0.29.0/`（**shipped**；**無** store migrate）
- **更早：** `0.28.0` — Node 主檔 `{id}.md`＋Obsidian vault＝`memories/`＋Structure notes — 見 `docs/roadmap/0.28.0/`（**shipped**；**有** store migrate）
- **更早：** `0.27.0` — Amend-dream（pending 同稿自由句小修）— 見 `docs/roadmap/0.27.0/`
- **更早：** `0.26.0` Node API `understanding`；`0.25.0` standing understanding；`0.24.0` 空 pool 入夢＝rollup-only
- **Backlog：** 見 `docs/roadmap/backlog/`（含 Seek／network 依分等）
- **遷移：** 0.16→0.17／0.17–0.18→0.19／**0.19–0.27→0.28** store 見 **engram-migration** skill（勿手改記憶庫當 migrate；**0.28 hop 離線、無需先 start server**，會丟棄未批准 dream）；**0.19→0.20／0.24→0.25／0.25→0.26／0.26→0.27／0.28→0.29／0.29→0.30／0.30→0.31／0.31→0.32 無 migrate hop**
## 深入閱讀

- Roadmap 寫作：`docs/roadmap/GUIDELINES.md`
- Roadmap 開發節奏（多 agent）：`docs/roadmap/agent-workflow.md`
- API 總覽：`docs/api-docs/README.md`
- API 契約：`docs/api-docs/api.md`
- Server：`server/README.md`
- Web：`web/README.md`
- MVP 設計筆記：`docs/roadmap/0.1.0/docs/`
