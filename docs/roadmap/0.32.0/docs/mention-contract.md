# 0.32 — Activity mention 契約

← [INDEX](../INDEX.md)

做什麼以 INDEX 已定案為準；本檔寫 **token 文法、解析、API 錯誤、id、dream 注入**。

---

## 1. Token 文法（寫入 `raw`）

| 意圖 | 形態 | 例 |
|------|------|-----|
| 指向既有 node | `[@{label}](node:{id})` | `[@ken](node:ken)` |
| 宣告本輪應新建 | `[@{label}](node-create:{id})` | `[@tommy](node-create:tommy)` |

規則：

- Markdown link 形；destination **必須**精確為 `node:{id}` 或 `node-create:{id}`（無空白）。
- `{id}` 與 `{label}`：UI 預設相同；允許 label≠id（顯示名），**機器以 destination 的 id 為準**。
- 同一 `raw` 可有多個 mention；可與 `![[_attachments/…]]` 並存。
- **不是** Obsidian P1 `[[nodes/{id}/{id}|…]]`（那是 L2／chain 機器寫入形）。

### 非 mention（保留原文、不解析為意圖）

- `[ken](http://…)`、`[ken](nodes/ken)`、`[[ken]]`、裸 `@ken`（未確認成 pill／未序列化）
- `node_refs` JSON 欄位（已廢）

---

## 2. id 校驗（sanitize）

對 `node:`／`node-create:` 的 `{id}`：

1. Unicode trim；拒絕空字串  
2. 拒絕含 `/`、`\\`、空白、ASCII 控制字元  
3. 允許：ASCII `A–Z a–z 0–9 . _ -`，以及 Unicode 字母／數字（與現行 node 目錄名實務一致）  
4. 拒絕 `.`／`..` 作 id  

**Create 額外：** 若 live 已存在 `memories/nodes/{id}/`（或 nodes index 含該 id）→ **400** `mention_create_exists`（整次 `POST /activities` 失敗，不半寫）。

**Ref：** 允許指向尚未存在的 id（人可能打錯或先寫後建）；dream **不**因 ref 懸空而 400 capture。入夢時 ref 僅作消歧提示；寫 P1 仍遵守 0.31「存在才 link」。

---

## 3. `POST /activities`

### 請求

| 欄位 | 必填 | 說明 |
|------|------|------|
| `raw` | 是 | 可含上述 token |
| `source` | 否 | 同現行 |
| `attachments` | 否 | 同 0.29 |
| `node_refs` | **禁止** | 鍵存在 → **400** `node_refs_removed` |

### 伺服器步驟（概念）

1. 若 body 有 `node_refs` → 400  
2. 校驗 attachments（現行）  
3. 解析 `raw` 中所有合法 mention  
4. 任一 `node-create` 且 id 已存在 → 400 `mention_create_exists`  
5. 任一 token id 未過 sanitize → 400 `invalid_mention_id`  
6. 寫入 L0／short-term（**不**寫 `node_refs` 欄）

### 讀取舊資料

- JSONL／pool 列若仍有 `node_refs`：**忽略**；不報錯、不改檔。

---

## 4. Dream context

對 scope 內每個 event，除 `id`／`ts`／`raw` 外，附：

```json
"mentions": [
  { "id": "ken", "mode": "ref" },
  { "id": "tommy", "mode": "create" }
]
```

（由 raw 解析；實作可用同等欄位名，但語意須為此。）

Prompt 要點：

- `mode: create` → 本輪 draft **應**建立 `nodes/{id}/{id}.md`（standing 骨架）  
- `mode: ref` → 提及該實體時使用該 id；寫 Relation／chain 時用 P1（0.28／0.31）  
- 路人無名 mention → 不造 node  

漏建 create → Structure notes 警告一行（如 `mention create {id} missing from draft nodes`）；不失敗 job、不擋 approve。

---

## 5. UI 序列化

- Ref pill → `[@{id}](node:{id})`  
- Create pill → `[@{id}](node-create:{id})`  
- 使用者刪 pill＝從 raw 移除對應 token  
- 提交前若仍有未確認的裸 `@` 查詢字串：視為普通文字（或 UI 取消 popover 時還原）；**不要**自動當成 create

---

## 6. 測試鎖定建議

| 案例 | 期望 |
|------|------|
| body 含 `node_refs` | 400 `node_refs_removed` |
| raw 含 `node-create:acme` 且 acme 已存在 | 400 `mention_create_exists` |
| raw 含 `node-create:brandnew` | 201；dream mock 後有主檔 |
| 舊 fixture 列帶 `node_refs` 鍵 | 讀／replay 不炸（忽略） |
