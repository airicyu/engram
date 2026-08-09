# Migrate Engram store：0.19–0.27 → 0.28

← 路由器：[SKILL.md](./SKILL.md) · Roadmap 契約：[docs/roadmap/0.28.0/docs/migrate-0.19-to-0.28.md](../../../docs/roadmap/0.28.0/docs/migrate-0.19-to-0.28.md)

> **Hop：** 0.19.x–0.27.x（`nodes/{id}/understand/what.md`）→ **0.28.0**（`nodes/{id}/{id}.md`）。  
> **全程離線**（不經 HTTP、**無需先啟動 Engram server**）。  
> **不做：** 改寫正文成 wikilink；保留並轉換舊 pending draft；建立 `_attachments/`；推遠端；改產品 repo `.git`。

## 何時用本檔

- 使用者要升級 **0.19–0.27** 記憶庫以配合 **0.28+** server（node 主檔重構）。
- 線索：`store_version` major.minor ∈ 0.19–0.27；或仍有 `memories/nodes/*/understand/what.md`。

若 store **已是** `store_version: 0.28.0`（或更高結構代）且抽樣 node 已是 `{id}.md` → 告訴使用者可能已遷移，不要重複破壞性改寫。

## 前置

1. 取得 `ENGRAM_STORE_DIR` 絕對路徑；確認有 `memories/` 或 `engram.workspace.yaml`。
2. **備份：** 複製整個 store 到旁鄰目錄。**未備份不得改。**（清空 pending **不可逆**，必須先備份。）
3. **不必**先 `POST /dreams/discard` 或啟動 server——本 hop **離線清空** pending。

## 結構差（摘要）

| 項目 | 0.19–0.27 | 0.28 |
|------|-----------|------|
| Node 主檔 | `understand/what.md` | **`{id}.md`**（與資料夾同名） |
| Stub `INDEX.md` | 常見 | **刪除**（heuristic） |
| Pending dream | 可能存在 | **離線 discard**（刪 draft、run → discarded） |
| `store_version` | `0.19.x`–`0.27.x` | **`0.28.0`** |
| Obsidian vault | （未契約） | 人應開 **`memories/`** |

## 步驟（優先 script）

在 **engram 產品 repo 根**執行（會改 store；**須已備份**；**server 不必在跑**）：

```bash
bun .claude/skills/engram-migration/scripts/migrate-0.19-to-0.28.ts "$ENGRAM_STORE_DIR"
```

腳本完成：

1. **清空 pending（等價 discard）：** 將 `dreams/runs/*.yaml` 中 `status: pending` 改為 `discarded`；刪除 `dreams/draft/*`；寫 `dreams/extract-state.yaml` → `status: never`；**刪除 `dreams/dream.lock`（若存在）**。stdout 明示 `discarded pending dream(s): …`。
2. 對每個 live `memories/nodes/{id}/`：
   - 若有 `understand/what.md` 且無 `{id}.md` → **rename** 為 `{id}.md`。
   - 兩者皆存在 → **失敗退出**（勿半套遷移）。
   - 刪明顯 stub `INDEX.md`／`index.md`；移除空 `understand/`。
3. **不**建立 `memories/_attachments/`。
4. Stamp `store_version: 0.28.0`。
5. 若 store 為 git：`git add`＋commit（訊息含 hop；可註 discarded ids）。

## 自檢

- [ ] 無 `dreams/draft/*`（或僅空目錄）；無 `status: pending` 的 dream run
- [ ] 抽樣 live：`nodes/{id}/{id}.md` 存在；舊 `understand/what.md` 不存在
- [ ] `engram.workspace.yaml` → `store_version: 0.28.0`
- [ ] 0.28+ server 可啟動（boot 最低結構 **≥ 0.28**）；**無需**在 migrate 前先 start server
- [ ] stdout 曾列出 discarded pending（或 `(none)`）

## 非目標

- 不把散文人名自動改成 wikilink
- 不經 API discard／approve
- 不轉換舊 draft 路徑後保留 pending
- 不刪使用者自寫的非 stub `INDEX.md`（保守 heuristic）
