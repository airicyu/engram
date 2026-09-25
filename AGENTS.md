# Engram Lite — Agent Context

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**  
用書面語；專有名詞、路徑、API、檔名可留英文。

`version.md` 現行 **0.6.1**。近期出貨：[0.6.1 `@` 新建](docs/roadmap/0.6.1/INDEX.md)、[0.6.0 殼／活躍分](docs/roadmap/0.6.0/INDEX.md)、[0.5.0 UI 還原](docs/roadmap/0.5.0/INDEX.md)、[0.4.0 Import](docs/roadmap/0.4.0/INDEX.md)、[0.3.3 Engram 對齊](docs/roadmap/0.3.3/INDEX.md)（皆 `shipped`）。規劃中：[0.3.0](docs/roadmap/0.3.0/INDEX.md)（`planned`）。契約延伸：[0.3.0](docs/roadmap/0.3.0/INDEX.md)（`planned`；根目錄 `docs/data-spec.md`／`docs/api.md` 已對齊該 INDEX）。執行某版：`.agents/skills/roadmap-version`。上游：[0.2.0](docs/roadmap/0.2.0/INDEX.md)（`shipped`）、[0.1.0](docs/roadmap/0.1.0/INDEX.md)（`shipped`）。寫 roadmap：[GUIDELINES.md](docs/roadmap/GUIDELINES.md)。未排程：[backlog](docs/roadmap/backlog/INDEX.md)。

## VIP 規則：測試／demo／fixture 嚴禁真人真事

對齊完整 Engram：`bun run test:phases` 只用隔離的 `data-test/`；真人試用走空 store；fixture 勿用真人記憶正文；time-replay 獨立 `ENGRAM_STORE_DIR`，勿污染真人 store。

**本倉庫同等視為最高優先硬約束：**

| 准 | 不准 |
|----|------|
| 自動化測試用 `mkdtemp`／隔離路徑；`demo-engram-lite-data/` **只**放明顯虛構角色與情節（可標「虛構」） | 把 personal private 真人真事寫進 testing／demo／fixture／`demo-engram-lite-data/`（含真名、伴侶、婚禮、住址、真實客戶隱私等） |
| 真人記憶只當 runtime store（gitignore／倉庫外 `engram-lite-data`） | 為了「好測」從真人 vault 複製、貼上、或混寫進 demo |
| 發現 demo 混入真人內容：立刻清除或整庫 reset，並回報 | 假裝示範資料「差不多虛構就好」而留下可識別私事 |

違反此條視為事故，不是風格問題。Agent／人寫 seed、跑 E2E、開 PR 前都必須自檢。

## 這是什麼

個人記憶原型：**LLM／skills 寫檔是主體**，Bun server／UI 只是讀檔、機械寫入與派工。不必開 server：在倉庫根目錄用 **pi-agent** 跑 skills 即可。

對照完整 Engram：**沒有** dream staging、approve／discard、activities／short-term 雙軌、內建 cron daemon。Lite **有** **future-sight**（`upcoming.md`／`longTerm.md`；`GET /future-sight` expire→pending）、**store git**（記憶庫根 local-only git：server 列舉之成功寫入後自動 commit；無 push／無 approve）與釐清郵箱（`clarify/{asking,pending,history}`；`POST /distill` program **兩次獨立 session**（distill → clarify-generate 強制 3–5）；HTTP 只落答案；無 dream report）。純 pi-agent 直跑 skill 寫 vault **不**自動 commit。

| 層 | 角色 | 路徑 |
|----|------|------|
| **vault** | Obsidian 開這一層 | `{store}/memories/` |
| **pool** | 尚未沉澱的事件 | `{store}/memories/pool/pending.jsonl`（沉澱後進 `archived.jsonl`） |
| **clarify** | 釐清題／作答／已吸收 | `{store}/memories/clarify/{asking,pending,history}/` |
| **chain** | 日／週／月／年敘事 | `{store}/memories/chain/days\|weeks\|months\|years/` |
| **nodes** | 主題理解 | `{store}/memories/nodes/{id}/{id}.md` |
| **attachments** | 附圖（一步寫正式目錄） | `{store}/memories/_attachments/uploads/{日}/` |
| **jobs** | server 派工狀態 | `{store}/jobs/`（不進 vault；store git 亦忽略） |

`{store}` 見 `ENGRAM_LITE_STORE_DIR`（倉庫根 `.env` 或環境變數；未設時預設 `./demo-engram-lite-data`）。

契約真相：[`docs/data-spec.md`](docs/data-spec.md)。HTTP：[`docs/api.md`](docs/api.md)。版本：[`version.md`](version.md)。0.3.0 範圍與定案：[`docs/roadmap/0.3.0/INDEX.md`](docs/roadmap/0.3.0/INDEX.md)。

## 警世原則：調度寫死在 program，把判斷還給 skill

本倉庫自立原則（可單獨推 GitHub；文件與程式不依賴其他產品倉庫）。

| 准 | 不准 |
|----|------|
| **Program／server** 只寫死**控制面**：步驟順序、鎖、job／202、讀旗標、機械 I／O（讀檔、append、搬檔、校驗 path／MIME） | 在 server 重做「分類表／規則引擎」式**語意判斷**（怎麼寫日記、要不要開 node、出什麼釐清題、文體） |
| **語意判斷**只放在 **skill** 與 **data-spec**（契約描述「長成什麼」，不是 TypeScript 世界模型） | 把世界模型寫進 TypeScript——那是完整 Engram 變重的病根 |

**對照：** 薄管線（`POST` → job → skill）不是病；病是把「記憶／世界怎麼理解」塞進 program。改寫作行為 → 改 skill／規格；改派工與機械落盤 → 改 server。

**文件義務：** 凡存在寫死的控制面管線（例如 `POST /distill` → distill skill → clarify-generate），必須有**獨立說明**寫清：順序、為何這些步驟在 program 而不在 skill、禁區是什麼。權威短文：[`docs/architecture/orchestration.md`](docs/architecture/orchestration.md)；版本細節見該版 `docs/how.md`／`docs/reasoning.md`。

## Skills

| Skill | 作用 |
|-------|------|
| `engram-lite-ingest` | pi-agent 梳理事件 → pending（UI／`POST /events` 改為機械寫入，不經本 skill；**不**生釐清題） |
| `engram-lite-distill` | 先吸收 `clarify/pending/`，再寫 chain＋nodes、archive pool；**不**寫 asking；day 可帶同一 embed |
| `engram-lite-clarify-generate` | distill job 第二階段：在 `clarify/asking/` **強制新建 3–5** 題（無事可沉澱早退則跳過） |
| `engram-lite-ask` | 只讀 `memories/chain/`＋`memories/pool/pending.jsonl` 回答（不讀 archived／nodes／clarify） |
| `engram-lite-reset` | 清空記憶庫成初始空狀態（含 clarify；先確認；跑 skill 內 script） |

**升層閘門（distill）：** day 必寫；week／month／year 僅當時段**已結束**（當地今天晚於該週日／大於該月／大於該年），或使用者這次明說要寫。進行中的週月年不要改。

Chain：第一行 `##` 題材標題；分生命線、完整句子；週月年要取捨，禁止合訂本。

## Server（可選）

`bun run dev` → `127.0.0.1` + `ENGRAM_LITE_PORT`（`.env` 或環境變數）／`8797`。

- **同步讀檔：** `GET /search`、`/clarify/*`、`/nodes/graph`、`/attachments/file`、chain／nodes／pool／jobs 等。
- **機械寫入：** `POST /events`（可帶圖對稱校驗）、`POST /attachments`、釐清 submit／delete／aside。
- **202 派 Pi：** `POST /distill`／`/ask` 立刻 202，背景跑 skill。

**定時沉澱：** 不在 process 內建 cron。系統 crontab 對 `POST /distill` 即可（與 UI 按鈕同一 worker）。

Pi model：`ENGRAM_LITE_PI_MODEL`／`PI_MODEL` → 記憶庫 `workspace.yaml` `pi_model` → 預設 `deepseek/deepseek-v4.1-flash`。只影響 server SDK，不影響互動式 `pi` CLI。

UI 仍 `web/` 靜態（hash `#/events` `#/seek` `#/clarify` `#/memory`）；**不**引入 React／Vite。

## 操作邊界

| 做 | 不做 |
|----|------|
| 依 skill／規格讀寫 `memories/` 內 pool、clarify、chain、nodes、attachments | 發明 Engram dream／approve／git 流程；jobs 寫進 vault |
| 改契約時同步 `docs/data-spec.md`／`docs/api.md`；出貨才改 `version.md`／`changelog.md` | 把記憶寫作邏輯做成 server 規則引擎；server 出釐清題（見上方警世原則） |
| 真人記憶當 runtime（預設目錄 gitignore）；demo 只許虛構 | 把真人日記／pending／私事寫進源碼或 `demo-engram-lite-data/`（見上方 VIP 規則） |

時區：`workspace.yaml` → `ENGRAM_LITE_TZ` → `Asia/Hong_Kong`。  
記憶語言：`memory_language` → 預設 `zh-Hant`。
