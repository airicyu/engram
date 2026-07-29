# 0.17.0 — 未來視兩檔、格式、雙窗、分桶

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫磁碟與分桶 **HOW**。

## 目錄（`ENGRAM_STORE_DIR`）

```
memories/future-sight/
  hot.md      # zone: hot — 近窗熱區
  later.md    # zone: later — 仍在未來視窗內、未進熱區
```

**廢除：** `memories/future-sight/active/` 與 `active/{id}.md`。

`ensureEngramHome`：確保 `memories/future-sight/` 存在，並確保兩檔存在（可為「僅 frontmatter、無 item」的空骨架，避免讀取路徑分岐）。

**不進 git 的路徑不變**（`dreams/`、`tmp/`）；兩檔屬 `memories/**`，進 store git。

---

## 雙窗 config

| 鍵 | 預設 | 意義 |
|----|------|------|
| `future_sight_window_days` | `90` | 未來視**准入上限**（從入夢日 `T` 起算的天數） |
| `future_sight_hot_days` | `30` | 熱區上限（`T` 起算）；落在此窗內 → `hot.md` |

**來源優先序（必須與 `server/src/config.ts` 的 timezone／memory_language **同一算法**）：**

1. `engram.workspace.yaml` **若該鍵存在** → 用 workspace 值  
2. **否則**讀 env：`ENGRAM_FUTURE_SIGHT_WINDOW_DAYS`、`ENGRAM_FUTURE_SIGHT_HOT_DAYS`  
3. **否則**預設 90／30  

**不是**「env override workspace」。Workspace 寫了 30，就算 env 是 14，仍用 30。

**校驗：**

- 兩鍵加入 `config.ts` 的 `WORKSPACE_KEYS`（否則 unknown key **拒啟**）。
- 值須為正整數；非法 → **拒絕啟動**。
- **不**強制 `hot_days < window_days`。若 `hot_days >= window_days`，可能全部進 hot、later 恆空——**可接受**。

範例 `engram.workspace.yaml`：

```yaml
timezone: Asia/Hong_Kong
memory_language: zh-Hant
store_version: 0.17.0
future_sight_window_days: 90
future_sight_hot_days: 30
```

---

## 檔案格式（兩檔相同結構）

### 檔級 frontmatter

```markdown
---
zone: hot
updated_at: "2026-07-29T23:00:00+08:00"
---
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `zone` | 是 | 必須與檔名一致：`hot.md` → `hot`；`later.md` → `later` |
| `updated_at` | 建議 | 最後一次機械維護或 approve 寫入的 ISO 時間 |

### Item 區塊（**已鎖定**；Track 1 不得另選）

每個錨點依序：

1. 二級標題 `## {id}`（標題文字＝穩定 id）  
2. 緊接一個語言標籤為 `yaml` 的 code fence，內含 **僅** `anchor_start`／`anchor_end`（**不含** `id`；也不含 node／event／dream provenance）  
3. fence 結束後可空一行，再接 **正文**

示意（外層用四重反引號包住，避免與內層 fence 衝突）：

````markdown
## fs-2026-08-17-solana-agave-v4-2
```yaml
anchor_start: "2026-08-17"
anchor_end: "2026-08-17"
```

Solana Agave v4.2: first-stage 200ms slots …
````

| 欄位 | 規則 |
|------|------|
| `id` | 穩定；與 `##` 標題相同；同 id 不得同時出現在兩檔 |
| `anchor_start`／`anchor_end` | `YYYY-MM-DD`；`start ≤ end`；有效 timezone 日曆 |
| 正文 | 短敘述；非待辦系統 |

**不寫入 item：** `node_refs`、`event_refs`、`dream_run_id`、`committed_at`（舊檔若仍有，maintain／migrate 正規化時丟棄）。

**同一 `id` 只許出現在 `hot.md` 或 `later.md` 之一。**  
**禁止**無 fence 的「鍵行＋正文」變體——parse／migrate／AI 只認上述形狀。

**與 0.16 單檔格式的差：** 舊 `active/{id}.md`＝整檔 YAML frontmatter（含 `id` 與可選 provenance）＋正文。Migrate／render 只保留 id（標題）＋起訖日＋正文。
---

## 排序（寫入契約）

每個檔內 item 必須按：

1. `anchor_start` **升序**（越近越前）
2. 同分：`anchor_end` 升序
3. 仍同分：`id` 升序

機械維護與 AI 寫入後的 render **皆須**排序後再寫檔。`GET` 回傳順序＝檔內順序（hot 區與 later 區可分兩個陣列，或單一 `anchors[]` 且每筆帶 `zone`——**本版 API：單一 `anchors[]`，先列全部 hot（已排序），再列全部 later（已排序）**）。

---

## 過期邊界（對齊 0.4）

0.4：[expiry-and-api.md](../../0.4.0/docs/expiry-and-api.md) 定 `today > anchor_end` → 過期；區間內（含 **`today === anchor_end`**）仍活。

本版等價寫法（有效 timezone 的日曆日 `T`，含虛擬 clock）：

- **`anchor_end < T`** → 過期  
- **`anchor_end === T`** → **仍活**（可進 hot／later）

（0.4 文件曾寫 Asia/Taipei；產品時鐘以 workspace／`ENGRAM_TZ`／預設 `Asia/Hong_Kong` 為準——過期**比較運算**不變，只換「哪一天叫 T」。）

## 分桶規則（入夢日 `T`）

令：

- `hot_last = T + hot_days`（日曆日加法）
- `window_last = T + window_days`

對每個錨點，**先**套過期，再套出窗，再用 **`anchor_start`** 分區：

| 條件（依序） | 動作 |
|------|------|
| `anchor_end < T` | **過期**：移除；L0＋short-term；`source: system/future_sight_expired`，`ingest_meta.reason: past_anchor_end` |
| `anchor_start > window_last` | **出窗**：移出；同上 source，`reason: out_of_window` |
| `anchor_start ≤ hot_last` | 寫入 **`hot.md`** |
| `hot_last < anchor_start ≤ window_last` | 寫入 **`later.md`** |

**新內容准入（extract）：** 僅當 `anchor_start ≤ window_last` 且 `anchor_end ≥ T` 才可寫入兩檔；否則不進未來視（改 chain／node／當日敘事）。

---

## 與 0.16 draft 的對照

| 0.16 | 0.17 |
|------|------|
| draft 可含 `memories/future-sight/active/{id}.md` | draft 只應改 **`hot.md`／`later.md`**（整檔 file_update） |
| 多 path 一錨 | 最多兩 path |

Report 的 Near future／Appendix 改列這兩 path（若本輪有動）。
