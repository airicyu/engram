# Migrate Engram store：0.15 → 0.16

← 路由器：[SKILL.md](./SKILL.md) · Roadmap 契約：[docs/roadmap/0.16.0/docs/migrate-0.15-to-0.16.md](../../../docs/roadmap/0.16.0/docs/migrate-0.15-to-0.16.md)

> **Hop：** 0.15.x 磁碟形狀 → 0.16.x（store local git、summary／what 無 Current／History、ledger 無檔頂日期標題）。  
> **不做：** 重放歷史 dream；改寫歷史 `patches.jsonl`；推遠端；修改 engram 產品 repo 的 `.git`。

## 何時用本檔

- 使用者要升級 **0.15** 記憶庫以配合 **0.16** server。  
- 線索：day `*.summary.md` 或 `nodes/*/understand/what.md` 仍有 `## Current`／`## History`；store 根目錄尚無 `.git`。

若 store **已像 0.16**（無 Current／History、已有 `.gitignore` 含 `dreams/`／`tmp/`、已有 `.git`）→ 告訴使用者可能已遷移，抽樣確認後不要重複破壞性改寫。

## 前置

1. 取得 `ENGRAM_STORE_DIR` 絕對路徑；確認有 `memories/` 或 `engram.workspace.yaml`。
2. **備份：** 複製整個 store 到旁鄰目錄（例如 `{store}-backup-0.15-{timestamp}`）。**未備份不得改。**
3. **Pending draft：** 若 `dreams/draft/` 非空——要求使用者先在舊版 discard／approve，或明確接受「將刪除未批准 draft」。不要嘗試把舊 draft「轉換」成 0.16 draft。

## 結構差（摘要）

| 項目 | 0.15 | 0.16 |
|------|------|------|
| Store git | 無 | 根 `.git`＋`.gitignore`（`tmp/`、`dreams/`） |
| 追蹤 | — | `memories/**`、`engram.workspace.yaml`；**不**追 `dreams/`、`tmp/` |
| Day summary／`what.md` | `## Current`＋`## History` | 整檔＝原 Current；**丟棄 History** |
| Day ledger | 常有 `# YYYY-MM-DD` | 去掉該 heading；保留 patch metadata |
| Week summary 檔名 | `YYYY-Www.summary.md` | **`YYYY-Www-MMDD.summary.md`**（`MMDD`＝該週週一）；見 [week-id-mmdd.md](../../../docs/roadmap/0.16.0/docs/week-id-mmdd.md) |
| `store_version` | （通常缺） | `engram.workspace.yaml` → **`0.16.0`**；見 [store-version.md](../../../docs/roadmap/0.16.0/docs/store-version.md) |
| `patches.jsonl` | 入夢驅動 | 不再驅動；可留檔 |

## 步驟（優先 script）

在 **engram 產品 repo 根**（不是 store）執行機械腳本（會改 store 內檔；**須已備份**）：

```bash
bun .claude/skills/engram-migration/scripts/migrate-0.15-to-0.16.ts "$ENGRAM_STORE_DIR"
```

腳本完成：summary／what 整形、ledger 去日期標題、**legacy week id rename**（`YYYY-Www`→`YYYY-Www-MMDD`）、**stamp `store_version: 0.16.0`**、`.gitignore`、`git init`（若無）＋初始／migrate commit。  
若無法跑 bun，再依下列手動步驟（規則相同）。

### 1) Summary／what 整形

對每個：

- `memories/chain/days/**/*.summary.md`
- `memories/nodes/*/understand/what.md`

規則：

1. 若有 `## Current`：取 Current 與下一 `## History`（或 EOF）之間正文，trim → **整份新檔內容**。
2. 若無 `## Current`：視為已是正文，可只 trim。
3. **刪除** `## History` 及其後全部（不另存）。
4. 寫回同 path（UTF-8，檔尾單一 newline）。

### 2) Ledger 去日期標題

對每個 `memories/chain/days/**/*.md`（**排除** `*.summary.md`）：

1. 若第一個非空行是 `# YYYY-MM-DD`（日期標題）→ 刪該行及緊隨一空行。
2. **保留** `<!-- patch:… -->`、`### patch:… · events:[…]` 與正文。

### 2b) Week id rename（`YYYY-Www` → `YYYY-Www-MMDD`）

對每個 `memories/chain/weeks/**/YYYY-Www.summary.md`（恰好兩段、無 `-MMDD`）：

1. 以 ISO week-year＋週序算出該週 **週一** `YYYY-MM-DD`，取 `MMDD`。
2. Rename 為同月資料夾下（或週一所在 `YYYY-MM/`）的 `{YYYY-Www-MMDD}.summary.md`。
3. 更新 `memories/chain/initialized_weeks.yaml` 內對應 id。

腳本 `renameLegacyWeekIds` 已含此步；已是 0.16 僅缺 week 新 id 時可重跑整支 migrate（幂等）或只呼叫該函式。

### 2c) Stamp `store_version`

在 `engram.workspace.yaml` 寫入／覆寫 `store_version: 0.16.0`（保留既有 `timezone`／`memory_language`）。若檔不存在則建立。  
**不要**在未跑完結構改寫前就 stamp（避免半套庫被標成 0.16）。

### 3) Git 初始化

在 `ENGRAM_STORE_DIR`：

1. 確認本機有 `git`；否則停止並告知 0.16 **要求 git**。
2. 若無 `.git` → `git init`。
3. 寫入／合併 `.gitignore`，至少含：

```
tmp/
dreams/
log/
```

（腳本會寫入 `log/`；與 0.16 server ensure 一致。）
4. `git add memories engram.workspace.yaml .gitignore`（workspace 若存在才 add）。
5. **不要** `git add dreams/` 或 `tmp/`。
6. 若尚無 commit → `git commit`（訊息例如 `engram: migrate store 0.15 → 0.16`）。

### 4) 清理（可選）

- 若使用者同意刪除未批准 draft：可移除 `dreams/draft/*`（勿動已備份）。

## 自檢清單（必須逐項向使用者報告）

- [ ] 抽樣 ≥1 個 day summary、≥1 個 `what.md`：無 `## Current`／`## History`
- [ ] 抽樣 ≥1 個 ledger：無檔頂 `# 日期`；仍有 patch marker（若該日曾有 block）
- [ ] week 檔名／`initialized_weeks` 為 `YYYY-Www-MMDD`（無裸 `YYYY-Www`）
- [ ] `engram.workspace.yaml` 有 `store_version: 0.16.0`
- [ ] `.gitignore` 含 `tmp/`、`dreams/`
- [ ] `git -C "$ENGRAM_STORE_DIR" status` 乾淨或僅說明中的預期變更
- [ ] 提醒：用 **0.16 server** 啟動（需 git）做 smoke：`GET /status`、讀 chain；（可選）一輪入夢

## 非目標

- 不重跑 dream；不改 L0 `events.jsonl` 歷史行；不推 GitHub；不修改 engram 應用 repo 的 `.git`；不把 `dreams/` stage 進 store git。
