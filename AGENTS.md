# Engram Lite — Agent Context

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**  
用書面語；專有名詞、路徑、API、檔名可留英文。

現行版本：**0.2.0**（[`version.md`](version.md)、[`changelog.md`](changelog.md)）：[Obsidian vault＝`memories/`](docs/roadmap/0.2.0/INDEX.md)（`shipped`）。上游：[0.1.0](docs/roadmap/0.1.0/INDEX.md)（`shipped`）。寫 roadmap：[GUIDELINES.md](docs/roadmap/GUIDELINES.md)。未排程：[backlog](docs/roadmap/backlog/INDEX.md)。無進行中的下一版。

## 這是什麼

個人記憶原型：**LLM／skills 寫檔是主體**，Bun server／UI 只是讀檔與派工。不必開 server：在倉庫根目錄用 **pi-agent** 跑 skills 即可。

對照完整 Engram：**沒有** dream staging、approve、store git、clarify、future-sight、activities／short-term 雙軌。

| 層 | 角色 | 路徑 |
|----|------|------|
| **vault** | Obsidian 開這一層 | `{store}/memories/` |
| **pool** | 尚未沉澱的事件 | `{store}/memories/pool/pending.jsonl`（沉澱後進 `archived.jsonl`） |
| **chain** | 日／週／月／年敘事 | `{store}/memories/chain/days\|weeks\|months\|years/` |
| **nodes** | 主題理解 | `{store}/memories/nodes/{id}/{id}.md` |
| **attachments** | 附圖（目錄已定） | `{store}/memories/_attachments/uploads/` |
| **jobs** | server 派工狀態 | `{store}/jobs/`（不進 vault） |

`{store}` 見 `engram-lite.yaml` `store_dir`（本倉庫示範為 `./demo-engram-lite-data`；未設時預設 `./../engram-lite-data`）。

契約真相：[`docs/data-spec.md`](docs/data-spec.md)。HTTP：[`docs/api.md`](docs/api.md)。版本：[`version.md`](version.md)。

## Skills

| Skill | 作用 |
|-------|------|
| `engram-lite-ingest` | pi-agent 梳理事件 → pending（UI／`POST /events` 改為機械寫入，不經本 skill） |
| `engram-lite-distill` | 寫 chain＋nodes，再 archive pending |
| `engram-lite-ask` | 只讀 `memories/chain/`＋`memories/pool/pending.jsonl` 回答（不讀 archived／nodes） |
| `engram-lite-reset` | 清空記憶庫成初始空狀態（先確認；跑 skill 內 script） |

**升層閘門（distill）：** day 必寫；week／month／year 僅當時段**已結束**（當地今天晚於該週日／大於該月／大於該年），或使用者這次明說要寫。進行中的週月年不要改。

Chain：第一行 `##` 題材標題；分生命線、完整句子；週月年要取捨，禁止合訂本。

## Server（可選）

`bun run dev` → `127.0.0.1` + `ENGRAM_LITE_PORT`／`engram-lite.yaml` `port`／`8797`。GET 與 **`POST /events` 同步讀寫檔**。`POST /distill`／`/ask` 立刻 **202**，背景跑 Pi skill。

Pi model：`ENGRAM_LITE_PI_MODEL`／`PI_MODEL` → 記憶庫 `workspace.yaml` `pi_model` → 預設 `deepseek/deepseek-v4.1-flash`。只影響 server SDK，不影響互動式 `pi` CLI。

## 操作邊界

| 做 | 不做 |
|----|------|
| 依 skill／規格讀寫 `memories/` 內 `pool`、`chain`、`nodes` | 發明 Engram dream／approve／git 流程；jobs 寫進 vault |
| 改契約時同步 `docs/data-spec.md`；出貨改 `version.md`／`changelog.md` | 把記憶寫作邏輯做成 server 規則引擎 |
| 真人記憶當 runtime（預設目錄 gitignore） | 把真人日記／pending 當原始碼提交（`demo-engram-lite-data/` 虛構示範除外） |

時區：`workspace.yaml` → `ENGRAM_LITE_TZ` → `Asia/Hong_Kong`。  
記憶語言：`memory_language` → 預設 `zh-Hant`。
