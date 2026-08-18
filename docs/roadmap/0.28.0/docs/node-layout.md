# Node 主檔佈局與 vault 契約（0.28）

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫清路徑字串與 migrate 機械步驟，供實作／migration skill 對照。

---

## 1. 目標磁碟形狀

```text
{ENGRAM_STORE_DIR}/
├── engram.workspace.yaml          # store_version: 0.28.0（migrate／新建 stamp）
├── dreams/                        # 暫存；不進 Obsidian vault
└── memories/                      # ← Obsidian vault root
    ├── activities/
    ├── short-term-memory/
    ├── future-sight/
    ├── chain/
    └── nodes/
        └── {id}/
            ├── {id}.md            # standing understanding（主檔）
            ├── node.meta.yaml
            └── score.yaml         # 0.19+ 既有
```

（`_attachments/` 留給附圖版；本版不建立。）

### 主檔內容（語意＝0.25，路徑變）

整檔＝API `understanding`。期望四段（英文小標、順序固定）：

```markdown
## Identity

…

## Relation

…（提及其他 node 時含 wikilink；形態見 INDEX P1）

## Standing facts

…

## Current situation

…
```

空段保留標題，正文 `_None_`。

---

## 2. 舊 → 新對照

| 舊（≤0.27 結構） | 新（0.28） |
|------------------|------------|
| `memories/nodes/{id}/understand/what.md` | `memories/nodes/{id}/{id}.md` |
| `memories/nodes/{id}/INDEX.md`（stub） | **刪除**（主檔即入口） |
| `memories/nodes/{id}/understand/`（僅 what 時） | **刪除空目錄** |
| API 鍵 `understanding` | **不變** |
| Store 相對 path（git／draft 白名單） | 仍以 **store 根** 起算：`memories/nodes/{id}/{id}.md` |
| Obsidian／人讀 wikilink | 以 **`memories/` vault** 起算：`nodes/{id}/{id}` |

**重要：** Engram server 內部與 draft 鏡像路徑繼續用 `memories/...`（相對 store）。寫進 **md 正文給 Obsidian 看的** link 用 vault-relative（無前綴 `memories/`）。

---

## 3. 關聯（wikilink）目標

| 對 | 錯 |
|----|-----|
| `[[nodes/mak/mak\|Mak]]` 或（若 P1 允許）`[[mak]]` | `[[what]]`、`[[index]]` |
| 指向主檔 | 指向 `node.meta.yaml`、`score.yaml` |
| 本輪新建：指向將寫入的 `nodes/{newId}/{newId}` | 只寫口語名、零連結 |

顯示名可用 `|`；aliases 可後補進 frontmatter（本版不強制改 meta schema）。

---

## 4. Migrate 機械步驟（摘要）

完整 hop 見 [migrate-0.19-to-0.28.md](./migrate-0.19-to-0.28.md)。核心：

**離線**對 `ENGRAM_STORE_DIR` 跑 script（**不**需 server／API）。

1. 備份後，若有 pending／`dreams/draft` → **清空**（等價 discard；見 migrate doc）。不改寫 draft 路徑。
2. 對每個 live `memories/nodes/{id}/`：
   - 若存在 `understand/what.md` 且尚無 `{id}.md` → **move／rename** 為 `{id}.md`。
   - 若兩者皆存在 → **停止該庫並報錯**。
   - 刪明顯 stub `INDEX.md`／`index.md`；移除空 `understand/`。
3. 確保（本版**不**建 `_attachments/`）；stamp `store_version: 0.28.0`；git commit（若 hop 要求）。

**不做：** 正文改寫；經 HTTP；保留並轉換舊 pending draft。

---

## 5. Server／測試斷言要點

- `understandingPath(id)` → `…/nodes/{id}/{id}.md`
- Create node：寫 `{id}.md` 種子；**不**寫 `understand/what.md`；**不**寫 stub INDEX
- Write-policy：允許 draft `memories/nodes/*/…/{id}.md`；舊 `understand/what.md` **不可寫**（測試覆蓋）
- Self-test／mock：approve 後 assert 新路徑存在、舊路徑不存在（新建案例）

---

## 6. 文件與使用者說明（出貨文案要點）

- 「請用 Obsidian 開啟記憶庫的 **`memories` 資料夾**。」
- 「Node 筆記檔名與資料夾 id 相同，例如 `nodes/eric/eric.md`。」
- （附圖目錄 `_attachments`：**非本版**；其後 [0.29.0](../0.29.0/INDEX.md)）
