# Engram — Agent Context

本檔（CLAUDE.md）是專案給 coding agent 的重要脈絡，會由 Cursor CLI／Claude Code 自動讀取。開始改碼或操作前先讀這裡。

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
| └ **nodes** | `memories/nodes/{id}/understand/what.md`（整檔＝最新理解） |
| └ **chain** | `memories/chain/days|weeks|months|years/`（day summary＝整檔敘事；ledger＝append-only） |
| **future-sight** | 近程前瞻錨點（`memories/future-sight/hot.md`＋`later.md`）；入夢前 script 過期／重桶並 git commit；GET 懶清過期 |
| **store git** | `ENGRAM_STORE_DIR` 必為 local git；追蹤 `memories/**`＋`engram.workspace.yaml`；**不**追 `dreams/`、store `tmp/` |
| **runtime temp** | `ENGRAM_TEMP_DIR`（預設 `/tmp`）：ask jobs＋dream agent disposable workdirs；不在記憶庫內 |

產品循環對齊 UI：**Activities → Consolidate → Seek → Memory**（場景 id：`activities`／`consolidate`／`seek`／`memory`）。

時區由 **有效 timezone** 決定：記憶庫內 `engram.workspace.yaml` → 環境變數 `ENGRAM_TZ` → 預設 **`Asia/Hong_Kong`**。  
記憶寫入語言：workspace config `memory_language` → 環境變數 `ENGRAM_MEMORY_LANGUAGE` → 預設 **`en`**（僅 `zh-Hant`｜`zh-Hans`｜`en`）。原型無 auth。  
記憶庫結構世代：workspace **`store_version`**（semver）。**0.19+**：啟動時 major.minor 須 **≥ 0.19**，缺鍵或過舊 → **拒啟**並提示跑 `.claude/skills/engram-migration/`（勿手改當 migrate）；`ENGRAM_ALLOW_STALE_STORE=1` 可警告後仍啟。migrate／新建才 stamp。**結構沒變的產品版可不 bump 舊庫**，但新建仍可能 stamp 產品版 → 同形狀可有多個字串；migrate 按**結構世代**、跨代**逐 hop**——見 `docs/roadmap/0.16.0/docs/store-version.md`、`docs/roadmap/0.19.0/docs/store-boot-gate.md`、`.claude/skills/engram-migration/SKILL.md`。


## 倉庫結構

| 路徑 | 用途 |
|------|------|
| `server/` | Bun HTTP API（記憶核心）— 預設 `127.0.0.1:8787` |
| `web/` | Vite + React workbench UI + `/api` proxy — 預設 `127.0.0.1:8788` |
| `setup-wizard/` | 首次 `bun run setup`（static HTML + mini Bun server） |
| `docs/api-docs/` | API 說明；契約細節見 `docs/api-docs/api.md` |
| `data/` | 預設記憶庫路徑（由環境變數 `ENGRAM_STORE_DIR` 指定；勿當原始碼改） |
| `docs/roadmap/` | 版本計畫；寫法見 [`docs/roadmap/GUIDELINES.md`](./docs/roadmap/GUIDELINES.md)；大功能先寫 plan、同意後再實作 |
| `.claude/skills/` | Workbench / kill-port 等技能 |

版本真相：`version.md`、`changelog.md`。

## 技術棧

- **Runtime：** Bun（TypeScript，ESM）
- **Server：** `Bun.serve({ routes })`
- **Web：** Vite + React + TypeScript；Bun 服務 `dist/` + proxy（prod）
- **Dream extract：** `AgentRunner`（預設 Claude Code；可切 `cursor` / mock）

常用指令：

```bash
# 首次設定（安裝依賴 + wizard）
bun run setup

# API
cd server && bun run dev          # watch，:8787
cd server && bun run reset        # 清空記憶庫（破壞性，需確認）

# UI
cd web && bun run dev             # :8788，proxy → ENGRAM_URL

# 根目錄捷徑
bun run dev                       # server
bun run dev:ui                    # web
```

## 操作邊界（極重要）

**操作記憶狀態時：只打 HTTP API，不要直接讀寫記憶庫下的 yaml、md、jsonl。**

| 做 | 不做 |
|----|------|
| `curl` / `engram-workbench` skill 打 API | 手改 `events.jsonl`、short-term notes、L2 `what.md` |
| `POST /activities` 寫入 | 把 fixture seed 當試用資料 |
| `POST /dreams/run` extract／file pipeline → pending（pending 時 409） | 未經同意就 `reset` |
| `POST /dreams/approve`／`discard`／`retry` | 手改 short-term／L2／draft「幫忙改對」 |
| `GET /memories/search` / `GET /memories/short-term-memory` / `POST /memories/ask` / `GET /memories/chain` / `GET /memories/nodes` / `GET /status` / `GET /dreams/pending` / `GET /memories/future-sight` / `GET|PUT|DELETE /clock` | 臆測 request 欄位名（API 嚴格，錯欄位 → 400） |

API 欄位提醒：

- activities body 用 **`raw`**（不是 `content` / `text`）；**不要**傳 `ts` — 要模擬過去時間先 `PUT /clock`
- memory search query 用 **`q`**（必填）；可選 **`scope`** = `l1,nodes,chain,future`（逗號分隔，預設四者全開）
- memory ask body 用 **`q`**；可選 **`include_later`**（boolean，預設 false＝可讀 hot、不可讀 later）
- dream **retry** body 用 **`reason`**（必填）；對同一凍結 scope 重跑，注入上一輪摘要
- dream **lock**（入夢／deploy）時 activities → `409 dream_locked`；**`pending_review` 可寫 activities**
- **`pending_review` 時不可**再 `POST /dreams/run`（改 approve／discard／retry）
- **虛擬時鐘：** `PUT /clock` 需 `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`；`DELETE /clock` 恆可；見 `/status.clock`
- **無資料不用 404**：讀取型「目前沒有內容」回 **200**，在 body 用 `null`／`[]`／`present: false` 等表達；404 留給路徑／方法真正不存在
- **未來視窗：** 有效 `future_sight_window_days`＝workspace → env → 預設 **365**；`hot_days` 預設仍 **30**

操作技能：`.claude/skills/engram-workbench/SKILL.md`  
埠被占用：`.claude/skills/kill-port/SKILL.md`

## API 未暴露（原型）

下列需人工／未來 API，勿假裝已有端點：

- Node merge／融合（見 roadmap；另版）
- 清空 store → 僅 `cd server && bun run reset`（先確認）

（0.3：dream 可直接 create live node；契約見 `docs/roadmap/0.3.0/INDEX.md`。）

## 開發慣例

1. **先 plan 後實作**：roadmap 條目未同意前，不大改記憶契約或 patch schema。Roadmap 必須 **self-sufficient**（新開 agent 不靠對話殘留也能開工）；見 [`docs/roadmap/GUIDELINES.md`](./docs/roadmap/GUIDELINES.md)。
2. **UI 跟記憶循環走**：是個人記憶工作台，不是 admin dashboard；不要首屏塞 stats／多欄卡片牆。
3. **最小改動**：只改任務需要的檔案；不順便重構、不亂加 markdown 文件。
4. **契約文件優先**：改 API 行為時同步 `docs/api-docs/`；改版本時更新 `version.md` / `changelog.md`。
5. **測試資料**：`bun run test:phases`（isolated `data-test/`）僅機械自測；真人試用走空 store + activities。

## 目前版本脈絡

- **已出貨：** `0.20.0` — 正確性加固＋結構重構（sandbox／lock／capture；generic agent；`agent/`／`dream/`／`api/` 分夾）— 見 `docs/roadmap/0.20.0/`（**shipped**；**無** store migrate）
- **上一版：** `0.19.0` — Node 活躍分（score）＋ report／2a category — 見 `docs/roadmap/0.19.0/`
- **更早：** `0.18.2` — Rollup plan／write 改 file deliverable；`0.18.1` — Rollup agent 跟隨 `ENGRAM_AGENT`；`0.18.0` — Seek 納入未來視＋`window_days` 預設 365
- **Backlog：** 見 `docs/roadmap/backlog/`（含 2b 自由句改 draft；Seek／network 依分）
- **遷移：** 0.16→0.17／0.17–0.18→0.19 store 見 `.claude/skills/engram-migration/`（勿手改記憶庫當 migrate）；**0.19→0.20 無 migrate**
## 深入閱讀

- Roadmap 寫作：`docs/roadmap/GUIDELINES.md`
- API 總覽：`docs/api-docs/README.md`
- API 契約：`docs/api-docs/api.md`
- Server：`server/README.md`
- Web：`web/README.md`
- MVP 設計筆記：`docs/roadmap/0.1.0/docs/`
