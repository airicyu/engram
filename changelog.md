# Changelog

版本真相：`version.md`（現行產品字串）＋本檔（已出貨摘要）。各版契約細節以 `docs/roadmap/X.Y.Z/` 為準。

---

## 0.2.0 — Obsidian vault＝`memories/`（2026-09-20）

記憶敘事與附圖目錄改到 `{store}/memories/`。Obsidian 開這一層。`jobs/` 與 `workspace.yaml` 留在 store 根。**不做**上傳 API、vision、完整 Engram store。見 `docs/roadmap/0.2.0/`。

### Changed

- `pool`／`chain`／`nodes` 路徑改為 `{store}/memories/…`
- Skills、reset、demo 庫、HTTP 讀寫跟新路徑
- 舊庫手移：`mkdir memories && mv chain nodes pool memories/`

### Added

- `{store}/memories/_attachments/uploads/`（目錄已定；embed 語法 `![[_attachments/uploads/{日}/{檔}]]`）

### Non-goals

- 上傳／tmp／housekeep API、vision、day ledger／`.summary.md`、`engram.workspace.yaml`、store git、dreams

---

## 0.1.0 — Skills 寫檔的個人記憶（2026-09-16）

Lite 基線：pi-agent skills 寫 pool／chain／nodes；可選 Bun UI。無 dream／approve／git／clarify。見 `docs/roadmap/0.1.0/`。

### Added

- ingest／distill／ask／reset skills；單檔 chain 敘事；可選 `POST /events`、`/distill`、`/ask`（後二者 202＋job）

### Non-goals

- Engram dream staging、approve、store git、clarify、future-sight
