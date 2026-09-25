# 0.4.0 HOW — import script

← [INDEX](../INDEX.md) · 前置契約：[0.3.3](../0.3.3/INDEX.md)

## CLI（目標形狀）

```bash
bun run scripts/import-from-engram.ts \
  --from /path/to/engram-data \
  --to /path/to/engram-lite-data \
  [--dry-run] [--yes] [--force] \
  [--chain] [--nodes] [--attachments] [--future-sight] [--pool] [--workspace] \
```

| 旗標 | 說明 |
|------|------|
| `--dry-run` | 預設；只列將寫入的相對路徑與統計 |
| `--yes` | 實際寫入目標 store |
| `--force` | 目標 `memories/` 非空仍繼續（行為見 INDEX 拍板） |
| 子旗標 | 預設全開；可只跑子集除錯 |

**安全：** 拒絕 `--from`＝`--to`；拒絕 `--to` 落在已知 Engram store 根（可檢查 `engram.workspace.yaml` + `dreams/` 同時存在時警告）。

## Chain 轉換

| Engram | Lite |
|--------|------|
| `…/days/YYYY-MM/YYYY-MM-DD.summary.md` | `…/days/YYYY-MM/YYYY-MM-DD.md` |
| `…/weeks/YYYY-MM/YYYY-Www-MMDD.summary.md` | `…/weeks/{週一YYYY-MM}/YYYY-Www-MMDD.md` |
| `…/months/YYYY/YYYY-MM.summary.md` | `…/months/YYYY/YYYY-MM.md` |
| `…/years/YYYY.summary.md` | `…/years/YYYY.md` |
| Legacy `YYYY-Www.summary.md` | 用 `canonicalWeekIdFromLegacy`（`server/chain-time.ts`）再寫路徑 |

不複製無 `.summary` 的 ledger 檔（或僅在 summary 缺時 fallback——若做，須寫進 INDEX 並加測試）。

**附圖正文：** 讀入 summary 正文後呼叫 `normalizeAttachmentEmbedsInMarkdown`（`server/vault-embeds.ts`）。nodes 複製後對 `memories/nodes/**/*.md` 同法處理（僅新寫入檔；`--force` 跳過已存在）。pool 每列 `raw` 亦正規化。

## Pool 映射

Engram `PoolEntry`：`{ id, ts, raw, node_refs? }` → Lite `EventRow`：`id`（新 `evt_*`）、`ts`、`raw`；省略 `node_refs`（Lite 無此欄）。

## Workspace

| Engram `engram.workspace.yaml` | Lite `workspace.yaml` |
|-------------------------------|------------------------|
| `timezone` | 同鍵 |
| `memory_language` | 同鍵 |
| `future_sight_window_days` | 同鍵（若存在） |
| `future_sight_upcoming_days` | 同鍵 |
| `store_version` | **不寫** |
| `pi_model` | 可省略或寫 Lite 預設 |

## Fixture 測試

在 `scripts/fixtures/import-engram-mini/`（虛構角色）放：

- 一個 day summary、一個 week summary、一筆 pool 列
- 跑 import → assert 目標路徑與一筆 pending 內容

**VIP：** fixture 正文明顯虛構；勿從真人 `engram-data` 複製。

## 出貨時文件

`docs/data-spec.md` 增「自 Engram 匯入」短節：指向本 HOW + 禁止共用庫。
