# 0.13.0 — Workspace Config + First-run Setup

← [changelog](../../../changelog.md) · 上游：[0.12.0](../0.12.0/INDEX.md) · current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped（0.13.0）**  
> 兩塊：**A** per-`ENGRAM_HOME` workspace 偏好；**B** 首次 `bun run setup` wizard（產出 `.env` + data home + workspace yaml）。

## 產品句

> 第一次用 Engram 可用 setup wizard 選好 data home／時區／記憶語言／agent／埠；之後每個 data 庫用 `engram.workspace.yaml` 帶著自己的 timezone 與寫入語言，不必改 server 進程才能分開兩套世界。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [CLAUDE.md](../../../CLAUDE.md) | 語言、API 邊界、禁止手改 store |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收、錨點 |
| 2 | [docs/reasoning.md](./docs/reasoning.md) | 為何如此定（反例、否決項） |
| 3 | Bun 官方 | [HTTP Server](https://bun.com/docs/runtime/http/server)（`port: 0`、`server.url`、`Bun.file`、`stop`）；[Shell](https://bun.com/docs/runtime/shell)（`$`） |

---

## 與 0.12 對照

| 題 | 0.12 | 0.13 |
|----|------|------|
| Timezone | 僅 `ENGRAM_TZ`（預設 `Asia/Hong_Kong`） | workspace yaml 可覆蓋；否則同 0.12 |
| 記憶寫入語言 | 未約束（跟內容／模型走） | **永遠有有效語言**：workspace → `ENGRAM_MEMORY_LANGUAGE` → **`en`** |
| 首次安裝 | 人手抄 `.env.example` | `bun run setup` wizard |
| Runtime 改 workspace | — | 仍無 API／設定頁（人手改 yaml 或重跑 setup 覆寫） |

---

## 已定案（勿再問、勿擅自改語意）

### A — Workspace config

| # | 題 | 決定 |
|---|-----|------|
| A1 | 檔案 | `{ENGRAM_HOME}/engram.workspace.yaml` |
| A2 | 允許鍵 | 僅 `timezone`（IANA string）、`memory_language`（見 A4）。**未知鍵 → 拒絕啟動（C1）** |
| A3 | Timezone 有效值 | workspace 合法 IANA → 否則 `ENGRAM_TZ` → 否則 `Asia/Hong_Kong`。非法 IANA → C1 |
| A4 | `memory_language` 枚舉 | **僅** `zh-Hant`｜`zh-Hans`｜`en`（exact match）。禁止自由字串 |
| A5 | 語言有效值 priority | workspace 合法值 → 否則 `ENGRAM_MEMORY_LANGUAGE` 合法值 → 否則 **`en`** |
| A6 | 載入時機 | Server **boot-time** 讀入 merge；本版**不做**熱重載 |
| A7 | `/status` | `timezone`＝effective；新增 `memory_language`＝effective（永遠三碼之一）。不加 `*_source` |
| A8 | 語言作用面 | extract 人讀字串；rollup planner reason；rollup writer summary；memory ask **回答**。Prompt 注入有效語言（如 `{{MEMORY_LANGUAGE}}`）+ timezone |
| A9 | 不改寫 | **L0 `raw`** 永不改。既有 L2／舊 chain **不回溯**。week／month／year **整段重寫**時用**當下**有效語言 |
| A10 | Node 名 | 沿用用戶首次稱謂；本版不做正名／錯字修正專案 |
| A11 | 虛擬時鐘 | 仍進程級（`ALLOW_VIRTUAL_CLOCK`）；日曆語意用**有效** timezone |
| A12 | 進程仍屬 `.env` | 埠、`ENGRAM_AGENT`、runner binary、`ALLOW_VIRTUAL_CLOCK` 等**不**進 workspace yaml |

### B — Setup wizard

| # | 題 | 決定 |
|---|-----|------|
| B1 | 入口 | 根目錄 `bun run setup` |
| B2 | 程式位置 | 全部在 [`setup-wizard/`](../../../setup-wizard/)（`index.html` + Bun server）；**不**塞進 `web/` Vite |
| B3 | 啟動順序 | Console 說明 → `server/`＋`web/` 各 `bun install` → 起 wizard server → **console 印 URL** → **自動開瀏覽器** → 等 submit |
| B4 | Port | **`Bun.serve({ port: 0 })` 隨機可用 port**；用 `server.url`／`server.port`；HTML **相對路徑** `POST /setup`（同源） |
| B5 | UI | Self-contained static HTML，由 mini server **HTTP serve**（`GET /` → html）。**不做** `file://` 主路徑 |
| B6 | 開瀏覽器 | Bind 成功後 OS opener 開同一 URL；失敗只 warn、server 繼續（用戶可靠 console URL） |
| B7 | Bun 原生 | 優先 [Bun.serve](https://bun.com/docs/runtime/http/server)＋[Bun Shell `$`](https://bun.com/docs/runtime/shell)；`server.stop()` graceful shutdown。勿自造 HTTP／shell 輪子 |
| B8 | 表單題 | Timezone（偵測 IANA recommend + 可搜尋 IANA 列表；**禁止裸 offset 寫入**）；Memory language（必問；display **English／繁體中文／简体中文** → 內部 `en`／`zh-Hant`／`zh-Hans`）；Data home 三選一（`<repo>/engram-data`、`<repo>/../engram-data`、手動絕對路徑）；Agent（Claude Code／Cursor CLI）；Server port（recommend 8787）；Web port（recommend 8788） |
| B9 | 覆寫 | 若 `server/.env` 或 `web/.env` 已存在且未確認覆寫 → **`409`**（JSON 說明）。確認後重送帶 `overwrite: true` |
| B10 | Submit 時序 | Validate → 覆寫閘 → **寫檔成功** → 才 **`200`**。失敗 → 非 200 + JSON（`error`／`code`／可選 `fields`）給 UI。成功後 console 成功訊息 → `server.stop()` 結束 process |
| B11 | 生成物 | `server/.env`（`ENGRAM_HOME`、`ENGRAM_TZ`、`PORT`、`ENGRAM_AGENT`、`ENGRAM_MEMORY_LANGUAGE`）；`web/.env`（`WEB_PORT`、`ENGRAM_URL`）；mkdir `ENGRAM_HOME`；`{ENGRAM_HOME}/engram.workspace.yaml`（`timezone`、`memory_language` 與表單一致） |
| B12 | Data home UX | 無原生 folder picker；選項 3＝文字絕對路徑 |

---

## 非目標

- Runtime `GET|PUT /workspace/config`、Workbench 日常設定頁、workspace 熱重載
- 多租戶 auth、一進程多 `ENGRAM_HOME`
- 用裸 UTC offset（`+8`）當最終 timezone 寫入值
- 回溯改寫 L0／舊 L2；強制 rename node
- 把 UI shell i18n 與 `memory_language` 綁成同一開關
- Wizard 做成 Vite／React 子專案，或純 `file://` 無 server 寫檔

（相關未來構想仍見 [backlog](../backlog/INDEX.md)。）

---

## 實作軌道

嚴格按序；每軌勾完再進下一軌。

### Track 0 — Workspace load + status

- **做：** 在 [`server/src/config.ts`](../../../server/src/config.ts)（或鄰近模組）boot 讀 `engram.workspace.yaml`；merge A3／A5；非法 → process 退出非 0 + 清楚 log。`GET /status` 報 effective `timezone`＋`memory_language`。
- **不做：** 熱重載、設定 API。
- **驗收：** 無檔時 timezone 同 0.12；語言為 `en`。壞 yaml／未知鍵／非法 enum → 拒啟。

### Track 1 — Prompt 注入語言

- **做：** extract／rollup-plan／rollup-write／memory-ask prompt + context 注入有效語言；行為對齊 A8／A9。
- **不做：** 改 L0；翻譯既有 md。
- **驗收：** 設 `zh-Hant` 時新 extract／rollup／ask 產出為繁中；`en` 時為英文（可用 mock agent／prompt 快照測注入字串存在）。

### Track 2 — Setup wizard

- **做：** [`setup-wizard/`](../../../setup-wizard/) HTML + Bun server；根 `package.json` 加 `"setup"`；行為對齊 B1–B12。
- **不做：** 塞進 `web/`；固定 8790；先 200 再背景寫檔。
- **驗收：** `bun run setup` 印 URL 並嘗試開瀏覽器；submit 寫出四類生成物；無 `overwrite` 撞既有 `.env` → 409；成功後 process 結束。

### Track 3 — 契約與文件出貨

- **做：** `docs/api-docs/api.md`（`/status.memory_language`、workspace 檔說明）；`changelog.md`；`version.md` → `0.13.0`；`CLAUDE.md`；`server/.env.example` 補 `ENGRAM_MEMORY_LANGUAGE`。
- **驗收：** `bun run test:phases` 全過；文件與行為一致。

---

## 驗收總表

- [x] 無 workspace 檔：timezone＝`ENGRAM_TZ` 鏈；`memory_language` effective＝`en`（**有意異於 0.12「未約束」**）
- [x] 合法 yaml 覆蓋 timezone／language；`/status` 反映 effective
- [x] 壞檔／未知鍵／非法值 → server 拒啟
- [x] 新寫入路徑遵循語言；L0 與舊 L2 不被改寫
- [x] `bun run setup`：install → random port → console URL → 開瀏覽器 → 表單 → 寫檔 → 200 → shutdown
- [x] 語言選項 UI 顯示 English／繁體中文／简体中文（非 raw code 當唯一標籤）
- [x] 既有 `.env` 無 overwrite → 409；有 overwrite → 可寫入
- [x] `bun run test:phases` 全過；api-docs／changelog／version／AGENTS 已更新

---

## 錨點檔案

| 路徑 | 角色 |
|------|------|
| `server/src/config.ts` | Env + workspace merge |
| `server/src/store/clock.ts` | 有效 timezone |
| `server/src/index.ts` | `/status` |
| `server/prompts/extract.md` | Extract 語言／timezone |
| `server/prompts/rollup-*.md` | Rollup |
| `server/prompts/memory-ask.md` | Ask |
| `setup-wizard/` | Wizard UI + mini server |
| `package.json`（repo 根） | `"setup"` script |
| `server/.env.example` | 文件化新 env |
| `docs/api-docs/api.md` | 契約 |
