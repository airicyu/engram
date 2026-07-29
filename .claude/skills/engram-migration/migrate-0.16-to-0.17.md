# Migrate Engram store：0.16 → 0.17

← 路由器：[SKILL.md](./SKILL.md) · Roadmap 契約：[docs/roadmap/0.17.0/docs/migrate-0.16-to-0.17.md](../../../docs/roadmap/0.17.0/docs/migrate-0.16-to-0.17.md)

> **Hop：** 0.16.x 未來視 `active/{id}.md` → 0.17.x **`hot.md`／`later.md`**。  
> **不做：** 重放歷史 dream；改 nodes／chain；推遠端；修改 engram 產品 repo 的 `.git`。

## 何時用本檔

- 使用者要升級 **0.16** 記憶庫以配合 **0.17** server。  
- 線索：`memories/future-sight/active/*.md` 仍在；或 `store_version: 0.16.0`。

若 store **已是** `hot.md`＋`later.md`、無 `active/`、且 `store_version: 0.17.0` → 告訴使用者可能已遷移，抽樣確認後不要重複破壞性改寫。

## 前置

1. 取得 `ENGRAM_STORE_DIR` 絕對路徑；確認有 `memories/` 或 `engram.workspace.yaml`。
2. **備份：** 複製整個 store 到旁鄰目錄（例如 `{store}-backup-0.16-{timestamp}`）。**未備份不得改。**
3. **Pending draft：** 若 `dreams/draft/` 非空——要求使用者先 discard／approve，或明確接受「將刪除未批准 draft」。不要嘗試把舊 `active/` draft 轉成 0.17。

## 結構差（摘要）

| 項目 | 0.16 | 0.17 |
|------|------|------|
| 未來視 | `memories/future-sight/active/{id}.md` | `hot.md`＋`later.md`（`## id`＋yaml fence＋正文） |
| 窗長 | 無 | 可選 `future_sight_window_days`／`future_sight_hot_days`（缺省 90／30；**不強制** migrate 寫入） |
| `store_version` | `0.16.0` | **`0.17.0`** |

## 步驟（優先 script）

在 **engram 產品 repo 根**執行（會改 store；**須已備份**）：

```bash
bun .claude/skills/engram-migration/scripts/migrate-0.16-to-0.17.ts "$ENGRAM_STORE_DIR"
```

腳本完成：

1. 以主機當日＋有效 timezone 為 `T`；讀 window／hot（workspace → 否則 env → 預設）。
2. 解析每個 `active/*.md`（0.16 整檔 frontmatter）。
4. 過期／出窗 → 寫 L0＋short-term（`system/future_sight_expired`＋`reason`）後丟棄。
5. 其餘依 `anchor_start` 分桶寫入 `hot.md`／`later.md`（**僅**起訖日＋正文；丟棄舊 provenance 鍵；排序近→遠）。
5. 刪 `active/`。
6. Stamp `store_version: 0.17.0`。
7. `git add` 相關 path → commit（message 標明 migrate 0.16→0.17）。

### 手動等價（僅當無法跑 bun）

規則與腳本相同；見 roadmap [migrate-0.16-to-0.17.md](../../../docs/roadmap/0.17.0/docs/migrate-0.16-to-0.17.md)。

## 自檢

- [ ] 無 `memories/future-sight/active/`
- [ ] `hot.md`／`later.md` 可讀；id 不重複；近→遠
- [ ] 原未過期錨點仍在某一區；已過期者不在兩檔
- [ ] `engram.workspace.yaml` → `store_version: 0.17.0`
- [ ] 0.17 server 可啟動；`GET /memories/future-sight` 200；錨點帶 `zone`

## 非目標

- 重放 dream／改 chain／nodes 正文
- 強制寫入 window／hot 預設鍵到 workspace
