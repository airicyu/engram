# Engram — Agent Context

本檔是專案給 coding agent 的重要脈絡（等同 CLAUDE.md）。開始改碼或操作前先讀這裡。

## 語言（強制）

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**

- 用書面語，不用口語／網路腔（避免「喔」「啦」「欸」堆疊）
- 專有名詞、程式識別子、API path、檔名可保留英文原文
- 程式碼註解與 commit message：跟隨既有慣例；與使用者對話則用繁中書面語

## 這是什麼

**Engram** 是個人記憶原型：透過 HTTP API 走完 **capture → dream（extract + apply）→ recall**。

| 層 | 角色 |
|----|------|
| **L0** | 唯附加事件 log（`log/events.jsonl`） |
| **L1** | 短期記憶 pool（`short-term-memory/pool.jsonl`）；approve 成功後按 scope S 清理 |
| **L1.5** | dream intent（`dream/patches.jsonl` + report）+ draft 投影（`dream/draft/{run_id}/`）；Approve 才 commit 至 L2 |
| **L2** | 長期 node 理解（`nodes/{id}/understand/what.md`） |
| **chain** | 日級記憶鏈（`memory-chain/days/`） |
| **future-sight** | 近程前瞻錨點（`future-sight/active/`）；過期 → L0/L1 event 後硬清 |

產品循環對齊 UI：**Capture → Consolidate → Recall**（對應 capture / dream / recall）。

時區由 **`ENGRAM_TZ`** 設定（IANA），預設 **`Asia/Hong_Kong`**。原型無 auth。

## 倉庫結構

| 路徑 | 用途 |
|------|------|
| `server/` | Bun HTTP API（記憶核心）— 預設 `:8787` |
| `web/` | Vanilla workbench UI + `/api` proxy — 預設 `:8788` |
| `api-docs/` | API 說明；契約細節見 `api-docs/api.md` |
| `data/` | 預設 `ENGRAM_HOME`（執行期 store，勿當原始碼改） |
| `roadmap/` | 版本計畫；大功能先寫 plan、同意後再實作 |
| `.claude/skills/` | Workbench / kill-port 等技能 |

版本真相：`version.md`、`changelog.md`。

## 技術棧

- **Runtime：** Bun（TypeScript，ESM）
- **Server：** `Bun.serve({ routes })`
- **Web：** Vanilla HTML / CSS / JS，Bun 掛靜態 + proxy
- **Dream extract：** `AgentRunner`（預設 Cursor CLI `agent`；可切 `claude` / mock）

常用指令：

```bash
# API
cd server && bun run dev          # watch，:8787
cd server && bun run reset        # 清空 ENGRAM_HOME（破壞性，需確認）

# UI
cd web && bun run dev             # :8788，proxy → ENGRAM_URL

# 根目錄捷徑
bun run dev                       # server
bun run dev:ui                    # web
```

## 操作邊界（極重要）

**操作記憶狀態時：只打 HTTP API，不要直接讀寫 `ENGRAM_HOME` / `data/` 下的 yaml、md、jsonl。**

| 做 | 不做 |
|----|------|
| `curl` / `engram-workbench` skill 打 API | 手改 `events.jsonl`、L1 notes、L2 `what.md` |
| `POST /capture` 寫入 | 把 fixture seed 當試用資料 |
| `POST /dream/run` extract → pending | 未經同意就 `reset` 或清 DLQ |
| `POST /dream/approve`／`discard` | 手改 L1／L2／draft「幫忙改對」 |
| `GET /recall` / `GET /status` / `GET /dream/pending` / `GET /future-sight` | 臆測 request 欄位名（API 嚴格，錯欄位 → 400） |

API 欄位提醒：

- capture body 用 **`raw`**（不是 `content` / `text`）
- recall query 用 **`q`**
- dream **lock**（extract／commit）時 capture → `409 dream_locked`；**`pending_review` 可 capture**
- **無資料不用 404**：讀取型「目前沒有內容」回 **200**，在 body 用 `null`／`[]`／`present: false` 等表達；404 留給路徑／方法真正不存在

操作技能：`.claude/skills/engram-workbench/SKILL.md`  
埠被占用：`.claude/skills/kill-port/SKILL.md`

## API 未暴露（原型）

下列需人工／未來 API，勿假裝已有端點：

- 消化 `dead-letter.jsonl`
- Node merge／融合（見 roadmap；另版）
- 清空 store → 僅 `cd server && bun run reset`（先確認）

（0.3：dream 可直接 create live node；契約見 `roadmap/0.3.0/INDEX.md`。）

## 開發慣例

1. **先 plan 後實作**：roadmap 條目未同意前，不大改記憶契約或 patch schema。
2. **UI 跟記憶循環走**：是個人記憶工作台，不是 admin dashboard；不要首屏塞 stats／多欄卡片牆。
3. **最小改動**：只改任務需要的檔案；不順便重構、不亂加 markdown 文件。
4. **契約文件優先**：改 API 行為時同步 `api-docs/`；改版本時更新 `version.md` / `changelog.md`。
5. **測試資料**：`bun run test:phases`（isolated `data-test/`）僅機械自測；真人試用走空 store + capture。

## 目前版本脈絡

- **已出貨：** `0.5.0` — memory-chain ledger＋summary 雙軌；Web UI i18n（en／zh-Hant）；`ENGRAM_TZ`／熱路徑 cleanup；Recall 讀 summary（fallback ledger）。
- **Backlog：** 短期未來 mindzone、Recall 注入未來視 — 見 `roadmap/backlog/`。

## 深入閱讀

- API 總覽：`api-docs/README.md`
- API 契約：`api-docs/api.md`
- Server：`server/README.md`
- Web：`web/README.md`
- MVP 設計筆記：`roadmap/mvp/docs/`
