# 0.2.0 — Obsidian vault＝`memories/`

← [changelog](../../../changelog.md) · 上游：[0.1.0](../0.1.0/INDEX.md)（`shipped`）· current: [version.md](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-20）  
> 對齊 Engram 的 **vault＝`memories/`**，以便日後附圖用 `![[_attachments/uploads/…]]` 在 Obsidian 自然顯示。  
> **不**複製完整 Engram store（無 ledger／summary、無 activities／STM 雙寫、無 `store_version`、無 dreams）。

## 產品句

把日記、節點、pending 與附圖目錄放進 `{store}/memories/`。人用 Obsidian 開這一層。Server job 與 `workspace.yaml` 留在 store 根，不進 vault。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/reasoning.md`](./docs/reasoning.md)（為何不是整份 `engram-data`）
3. 契約：[`docs/data-spec.md`](../../../docs/data-spec.md)

## 與上一版對照

| 行為 | 0.1.0 | 0.2.0 |
|------|--------|--------|
| Vault | 開整個 `{store}` | 開 `{store}/memories/` |
| pool／chain／nodes | `{store}/pool` 等 | `{store}/memories/pool` 等 |
| jobs | `{store}/jobs` | **不變**（不進 vault） |
| 附圖 | 無目錄 | `memories/_attachments/uploads/`；尚無上傳 API |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 目錄名 | 用複數 **`memories/`**（與 Engram 相同），不用 `memory/`。 |
| 2 | Vault 內容 | `chain/`、`nodes/`、`pool/`、`_attachments/`。Wikilink／embed **相對 vault 根**，故 `[[nodes/…]]` 字面不變。 |
| 3 | 不進 vault | `{store}/workspace.yaml`、`{store}/jobs/`。對齊 Engram：設定與 dreams／jobs 不給 Obsidian 當筆記開。 |
| 4 | 附圖路徑 | 實體 `{store}/memories/_attachments/uploads/{YYYY-MM-DD}/{filename}`。引用只用精確 `![[_attachments/uploads/{日}/{檔}]]`，禁止 `\|alias`。各層只重複路徑，不複製 bytes。 |
| 5 | 上傳 | **本版只建目錄。** 無 multipart API、無 tmp、無 housekeep、無 vision。Capture 仍是文字 `POST /events`／ingest skill。 |
| 6 | 舊庫 | 無自動 migrate。手移：`mkdir -p memories && mv chain nodes pool memories/`（若仍在 store 根）。jobs 與 workspace.yaml 不動。 |
| 7 | 與 Engram 共存 | **禁止**把 Lite 指到 `engram-data`，也禁止 Engram 指到 Lite 庫。Lite 無 `store_version`；Engram 雙軌 chain 會被 distill 踩壞。 |
| 8 | Reset | 清空 `memories/pool|chain|nodes|_attachments/uploads` 與 `{store}/jobs`；保留 `workspace.yaml`。 |
| 9 | 本版不改 | HTTP 動詞、Pi job 202 模型、chain 單檔敘事、升層閘門、event JSON 欄位。 |

## 開工前仍須拍板

無。

## 非目標

- `POST /attachments/uploads`、tmp、對稱校驗、`## Attachment relationships` appendix
- 看圖／OCR ingest
- day `{id}.md` ledger + `{id}.summary.md`；week id 帶週一日期
- `activities/events.jsonl` 與 `short-term-memory/pool.jsonl`
- 改名 `engram.workspace.yaml`、stamp `store_version`、`dreams/`（**store git** 見 [0.3.2](../0.3.2/INDEX.md)）
- 立繪／場景圖（本產品非目標）

後續上傳見 [backlog／附圖捕捉](../backlog/INDEX.md)。

## 驗收

- [x] `chainFile("day", …)`／`nodeFile` 路徑含 `memories/`
- [x] `readPool` 讀 `memories/pool/*.jsonl`（demo archived 可空 pending）
- [x] demo 庫 `chain`／`nodes`／`pool` 在 `memories/` 下；`jobs` 與 `workspace.yaml` 在 store 根
- [x] 存在 `memories/_attachments/uploads/`（可空＋`.gitkeep`）
- [x] skills／reset／`docs/data-spec.md` 寫新路徑
- [x] `bun test` 全綠

## 實作軌道

| Track | 做 | 不要 |
|-------|----|------|
| A 路徑 | `paths.ts` `memoriesDir`；store／pi prompt／reset | 把 jobs 放進 memories |
| B demo／docs | 搬 demo；data-spec、AGENTS、skills | 改 chain 文體 |
| C 附圖目錄 | 建 `_attachments/uploads` | 做上傳 API |

## 錨點

`server/paths.ts`、`server/store.ts`、`.agents/skills/engram-lite-*/SKILL.md`、`.agents/skills/engram-lite-reset/scripts/reset-store.ts`、`docs/data-spec.md`、`demo-engram-lite-data/`。

← [0.1.0](../0.1.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
