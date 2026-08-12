# Migrate Engram store：0.17／0.18 → 0.19

← 路由器：[SKILL.md](./SKILL.md) · Roadmap 契約：[docs/roadmap/0.19.0/docs/migrate-0.18-to-0.19.md](../../../docs/roadmap/0.19.0/docs/migrate-0.18-to-0.19.md)

> **Hop：** 0.17.x–0.18.x（無 node score 檔）→ **0.19.0**（每 node `score.yaml`＋`node-score-registry.yaml`）。  
> **不做：** 重放歷史 dream；改 `what.md`／chain／未來視；推遠端；修改 engram 產品 repo 的 `.git`。

## 何時用本檔

- 使用者要升級 **0.17／0.18** 記憶庫以配合 **0.19** server（活躍分）。  
- 線索：`store_version` 為 `0.17.x`／`0.18.x`；或節點目錄無 `score.yaml`。

若 store **已是** `store_version: 0.19.0` 且既有 node 皆有 `score.yaml` → 告訴使用者可能已遷移，抽樣確認後不要重複破壞性改寫。

## 前置

1. 取得 `ENGRAM_STORE_DIR` 絕對路徑；確認有 `memories/` 或 `engram.workspace.yaml`。
2. **備份：** 複製整個 store 到旁鄰目錄。**未備份不得改。**
3. **Pending draft：** 若 `dreams/draft/` 非空——要求使用者先 discard／approve（本 hop 不碰 draft）。

## 結構差（摘要）

| 項目 | 0.17／0.18 | 0.19 |
|------|------------|------|
| Node 分 | 無 | `memories/nodes/{id}/score.yaml`（`score`＋`score_timestamp`） |
| 全域 max | 無 | `memories/node-score-registry.yaml`（`max_score`） |
| `store_version` | `0.17.x`／`0.18.x` | **`0.19.0`** |

## 步驟（優先 script）

在 **本 skill 目錄**執行（會改 store；**須已備份**）：

```bash
bun ./scripts/migrate-0.17-to-0.19.ts "$ENGRAM_STORE_DIR"
```

腳本完成：

1. 列出 `memories/nodes/*/`。
2. 缺 `score.yaml` 者寫入 `score: 100`（S0）＋ migrate 時刻 timestamp；已有者不覆寫。
3. 寫／更新 `memories/node-score-registry.yaml`：`max_score`＝全體 score 之 max（0 node → `0`）。
4. Stamp `store_version: 0.19.0`。
5. `git add`＋commit（`engram: migrate store 0.18→0.19 node scores`）。

## 自檢

- [ ] 每個既有 node 有 `score.yaml`；缺檔補上者為 `S0=100`
- [ ] registry `max_score` 正確（全 S0 → 100）
- [ ] `engram.workspace.yaml` → `store_version: 0.19.0`
- [ ] 0.19 server 可啟動；`GET /memories/nodes` 見 `display_score`

## 非目標

- 不回溯歷史夢重算分；不呼叫 downscale
- 不改 what／chain／未來視正文
