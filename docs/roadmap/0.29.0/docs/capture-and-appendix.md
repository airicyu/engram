# 0.29.0 — Capture 路徑、API、appendix 渲染

← [INDEX](../INDEX.md)

做什麼以 INDEX 已定案為準；本檔寫 **HOW**（路徑字串、請求形狀、校驗、appendix 字面格式），供實作與契約文件對齊。

---

## 1. 磁碟佈局（相對 store 根）

```text
memories/_attachments/uploads/{YYYY-MM-DD}/{filename}     # 已寫入 activity 的正式檔
memories/_attachments/uploads/tmp/{YYYY-MM-DD}/{filename} # compose 未 submit
```

- `{YYYY-MM-DD}`＝server **有效 timezone** 的日曆日（上傳當下時鐘／虛擬鐘）。
- Obsidian vault root＝`memories/` ⇒ embed＝`_attachments/uploads/{日}/{名}`（無 `memories/` 前綴、無 `tmp`）。

### 檔名與消毒

1. **只在 server 定名。** Client 候選名（或 clipboard `{uuid}{ext}`）僅作輸入。
2. 無衝突（該日 tmp **與** 正式目錄皆無同名）→ 用原名；否則  
   `{stem}-YYYYMMDD-HHmmss-{rand6}{ext}`，`rand6 = Math.random().toString(36).slice(2, 8)`。
3. 回應 `path` 一律最終形：`_attachments/uploads/{日}/{最終檔名}`（實體可仍在 tmp）。
4. **消毒：** `day`＝`/^\d{4}-\d{2}-\d{2}$/`；`filename` 單一段，禁 `..`、`/`、`\`、空字串；`attachments[].path` 必須精確 `_attachments/uploads/{day}/{filename}`。

---

## 2. HTTP

### 上傳限制

| 項 | 規則 |
|----|------|
| MIME | `image/jpeg`｜`image/png`｜`image/webp`｜`image/gif`；拒 HEIC／其餘 |
| 單檔 | 預設 **10485760** bytes；workspace `attachment_max_bytes`／env `ENGRAM_ATTACHMENT_MAX_BYTES`；超限 **400** `file_too_large` |
| 每則張數 | 不限 |

### `POST /attachments/uploads`

- Multipart 欄位名：**`file`**（單一圖檔）。
- 成功：**201**

```json
{
  "path": "_attachments/uploads/2026-08-09/menu.png",
  "day": "2026-08-09",
  "filename": "menu.png"
}
```

- 實體：`memories/_attachments/uploads/tmp/{day}/{filename}`。
- 錯誤：非法 MIME → 400；過大 → 400 `file_too_large`；非法名 → 400；**dream lock** → **409** `dream_locked`。

### `DELETE /attachments/uploads/tmp`

- **Query：** `?day={YYYY-MM-DD}&filename={filename}`
- 只刪 tmp 路徑；缺檔 → **200**（冪等）。
- 禁止刪正式 `uploads/{day}/`。

### `POST /activities`（擴充）

```json
{
  "raw": "今天吃了火鍋\n\n![[_attachments/uploads/2026-08-09/menu.png]]\n",
  "source": "web",
  "node_refs": ["optional"],
  "attachments": [
    {
      "path": "_attachments/uploads/2026-08-09/menu.png",
      "relationship": "鍋底與價目"
    }
  ]
}
```

| 規則 | 行為 |
|------|------|
| `raw` | trim 後非空；已含 `## Attachment relationships` → **400** |
| `attachments` 省略／`[]` | 同 0.28 純文字；`raw` 亦不得含 `_attachments/uploads/` 的 `![[…]]` |
| `relationship` | 每項 trim 後非空 |
| path 形狀 | 見 §1 消毒 |
| 重複 path | `attachments` 內同一 path 兩次以上 → **400** |
| 對稱 | 從 `raw` 收集精確 `![[{path}]]` 的 `{path}` 集合 ＝ `attachments[].path` 集合；`![[path\|x]]`／空白變體 **不計** → 導致集合不等 → **400** |
| 成功（capture lock 內） | 校驗 → 各 path tmp→正式 move → 組最終 raw → 寫 L0（含 `attachments`）＋STM |
| 寫入失敗 | 非 2xx；**best-effort** 已 move 檔搬回 tmp；搬回失敗則 log，仍非 2xx |
| 缺 tmp 檔 | **400**（含 housekeep 清掉後再 submit） |
| lock | **409** `dream_locked` |

**L0／STM 的 `raw`**＝請求正文＋server appendix（無附件則不追加 `------` 段）。`attachments` 欄可選；有則與最終 raw 一致。

---

## 3. Appendix 渲染（server 唯一寫入方）

```markdown
{request raw}

------

## Attachment relationships

### 1

**name:** ![[_attachments/uploads/{day}/{filename}]]

**relationship:**

{relationship 正文}

### 2

**name:** ![[…]]

**relationship:**

…
```

- `### {n}` 1-based，順序＝請求 `attachments` 陣列。
- `**name:**` 的 embed 與 `attachments[i].path` 一致（渲染時包上 `![[…]]`）。
- 不用 code fence 包 relationship。

---

## 4. 前端插入占位

於 textarea **selectionStart**：

1. 保證上下空行後插入精確 `![[{path}]]`（勿插入 `\|alias` 形）。
2. 推入 media attachments 狀態（待填 relationship）。

刪項：狀態移除；字串去掉該 `![[path]]`；`DELETE …/tmp?day=&filename=`。

---

## 5. Housekeep 與 Git

### Housekeep

- 只清 `memories/_attachments/uploads/tmp/**`
- **依目錄名日期**：有效時鐘「今天」− 目錄 `{YYYY-MM-DD}` 的日差 ≥ retention → 清理該日 tmp 目錄（或其內檔）
- 預設 retention **2**；`attachment_tmp_retention_days`／`ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS`
- 已知邊界：長時間未 submit 的 compose 可能缺檔 → activities **400**；UI 顯示即可

### Git

- Ignore：`memories/_attachments/uploads/tmp/`（ensure 時自動確保）
- 正式 `uploads/{日}/` 可被追蹤
- **Commit 時機對齊現行**：上傳／activities **不** commit；**dream approve** 才 `stageAndCommit` memories

---

## 6. Prompt 要點（Track C）

1. 見 `## Attachment relationships` → 用 relationship 理解圖；勿假設能看像素。
2. 選材寫入 chain 時用**同一**精確 `![[_attachments/uploads/…]]`。
3. Week／month／year 可省略圖。
4. 禁止發明不存在的 path。
