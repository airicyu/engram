# Changelog

版本真相：`version.md`（現行產品字串）＋本檔（已出貨摘要）。各版契約細節以 `docs/roadmap/X.Y.Z/` 為準。

---

## 0.6.0 — 殼收口、活躍分、匯入指引（2026-09-25）

見 [0.6.0](docs/roadmap/0.6.0/INDEX.md)。

### Added

- 側欄 **狀態燈**（`GET /status.queue`）、`.atmosphere`、job 時 `.stage-locked`
- `web/mention-composer.js`：`@` 節點 wikilink 發帖
- Node **`activity_score`** frontmatter（0–100）；`GET /nodes`／`GET /nodes/{id}`；節點詳情 UI
- Import：`nodes/{id}/score.yaml` → 合併 frontmatter

### Changed

- `docs/data-spec.md`、`docs/api.md`：活躍分與真人匯入檢查清單

### Deferred

- 尋問 scope 細節、distill 自動維護活躍分

---

## 0.5.0 — Import ＋ 記憶 UI 還原（2026-09-25）

離線 Engram → Lite 匯入（原 [0.4.0](docs/roadmap/0.4.0/INDEX.md) 範圍）與工作台記憶場景對齊 Engram（原 [0.5.0](docs/roadmap/0.5.0/INDEX.md) 範圍）。見各版 INDEX。

### Added

- `scripts/import-from-engram.ts`（`bun run import:engram`）、虛構 fixture／測試；`server/vault-embeds.ts` 匯入時 wikilink 正規化
- `GET /chain` 回 `items[]`（preview、週 `start`／`end`）；`listChainIndex`
- 記憶 UI：記憶鏈｜節點｜未來視、卡片列表、未來視分組、markdown 附圖（含 legacy `/api/attachments` 讀時）

### Changed

- `web/app.js`／`style.css`／`i18n.js`：記憶殼與鏈點選；日記圖 `max-width` 上限加大
- `docs/data-spec.md`、`docs/api.md`：匯入與附圖契約

### Deferred

- 側欄狀態燈、`@` mention、`.atmosphere` → **0.6.0**
- 節點活躍分 → **0.6.0**
- 入夢報告／dream review UI（非目標）

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
