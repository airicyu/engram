# Changelog

版本真相：`version.md`（現行產品字串）＋本檔（已出貨摘要）。各版契約細節以 `docs/roadmap/X.Y.Z/` 為準。

---

## 0.3.3 — Engram 對齊（讀寫契約）（2026-09-25）

週記 id、Unicode node、future-sight 與 Engram 0.40+ 同形；**無**離線 import。見 `docs/roadmap/0.3.3/`。

### Added

- `server/chain-time.ts`：week id `YYYY-Www-MMDD`；`GET /chain/week/{id}` 回 `start`／`end`；非法 id → `400 invalid_week_id`
- `server/node-id.ts`：node id 路徑安全（允許 Unicode）
- `server/future-sight.ts`：`GET /future-sight`（expire-only → `pending.jsonl`）；`/status` 計數
- UI：`#/memory/future`；記憶列表「未來視」分頁
- 測試：`chain-time`、`node-id`、`future-sight`、`graph` Unicode

### Changed

- Week 檔名：`memories/chain/weeks/…/YYYY-Www-MMDD.md`（demo 週檔已改名）
- `NODE_WIKILINK_RE`：`\1` 反照（alias 不污染 id）
- `docs/data-spec.md`、`docs/api.md`；ask／distill skills 讀寫 future-sight
- `AGENTS.md`：Lite 具 future-sight（仍無 dream／STM 雙軌）

### Non-goals

- Engram → Lite import script；clarify／dream 搬移；GET 時 upcoming↔longTerm 重分桶

---

## 0.3.2 — Store git（2026-09-21）

記憶庫根維護 local-only git：server 列舉之成功寫入（events、附件、釐清、distill job 完成、reset）後自動 commit；`jobs/` 不追蹤；git 失敗只 log。見 `docs/roadmap/0.3.2/`。

### Added

- `server/store-git.ts`（ensureRepo、commitStore、gitignore 合併）
- HTTP／job／reset 成功路徑掛鉤
- `server/store-git.test.ts`

### Changed

- `AGENTS.md`、`docs/data-spec.md`、`docs/api.md`：store git 行為

---

## 0.3.1 — Chain 日記文體質感（2026-09-21）

沉澱後的 day／week chain 契約補強：distill skill 獨立「Chain 文體」小節（書面語禁令、虛構 Day／Week 好壞例）、`docs/data-spec.md` 同義對齊、字串契約測。不改 server 文風引擎、不搬 dream 雙檔。見 `docs/roadmap/0.3.1/`。

### Changed

- `engram-lite-distill` skill：文體規則與好／壞例
- `docs/data-spec.md`：書面語禁令；clarify asking 歸 clarify-generate（與 0.3.0 編排一致）

### Added

- `server/chain-prose-contract.test.ts`（skill／data-spec 字串契約）

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
