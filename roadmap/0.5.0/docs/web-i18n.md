# Web UI i18n（0.5.0）

← [0.5.0 INDEX](../INDEX.md)

## 範圍

**只做 workbench UI 殼層字串的在地化**——按鈕、標籤、placeholder、狀態提示、錯誤訊息、aria-label 等。

| 在範圍內 | 不在範圍內 |
|----------|------------|
| `web/index.html` 靜態標籤 | L1 pool 原文 |
| `web/app.js` 的 `setMsg`／`adviceFor`／按鈕文案 | Dream **report**（`pending-report`） |
| 場景名、表單 hint、status light 說明 | Recall packet 內 **L2 what**、**chain**、**node** 內容 |
| `dream_status` 等 API 值的**顯示用**翻譯（key 仍為 API 原文） | Server 錯誤 `message` 的自動翻譯 |
| 語言切換器 UI | Memory store 內容的 translate／rewrite |
| `web/README.md` 操作說明（可跟進） | Extract prompt、API docs 多語 |

**原則：** 記憶內容語言由使用者 capture 時決定；UI 只決定「介面怎麼說話」。

## 現況（0.4.1）

`index.html` 已 `lang="zh-Hant"`，但字串**中英混用**：

- 場景 tab：**Capture / Consolidate / Recall**（EN）
- 內文 lead、placeholder、部分按鈕：**繁中**
- `app.js` 狀態建議、錯誤訊息：**繁中**
- Consolidate 面板 dt：**dream_status**、**lock**（API 識別子原文）
- Recall 區塊標題：**L1 / Day chain / Nodes**（EN）

0.5.0 目標：抽成 locale 檔，**僅兩種語言**完整覆蓋 UI 殼層，並可切換。

## 語系（僅兩種）

**0.5.0 只支援下列兩種 UI 語言，不加第三語、不加簡體、不加其他變體。**

| Code | UI 顯示名 | 說明 |
|------|-----------|------|
| `zh-Hant` | 繁體中文 | **預設**（與現有 `<html lang="zh-Hant">` 一致） |
| `en` | English | 唯一第二語系 |

- Locale 檔：**僅** `web/i18n/zh-Hant.json` 與 `web/i18n/en.json`。
- 切換器：**僅**「繁體中文 | English」兩項（或等價標籤），無下拉多語清單。
- `setLocale()` 只接受 `zh-Hant` | `en`；其他值 fallback `zh-Hant`。
- **不在本版：** `zh-Hans`、粵語、日文、依地區自動擴充語系包等。

## 實作方向（建議）

```
web/
├── i18n/
│   ├── zh-Hant.json
│   └── en.json
├── i18n.js          # t(key, vars?), setLocale(), getLocale()
├── index.html       # data-i18n="key" 或 JS 初始化時填
└── app.js           # 所有使用者可見字串走 t()
```

### 機制

1. **JSON 扁平或巢狀 key**：如 `scene.capture`、`capture.placeholder`、`status.advice.pending_review`。
2. **`t(key, vars?)`**：簡單 `{name}` 插值（如 DLQ 筆數）。
3. **語言持久化**：`localStorage` `engram.locale`（值僅 `zh-Hant` | `en`）；首次可依 `navigator.language` 推斷（`zh-TW`／`zh-HK`／`zh-Hant` → 繁體中文，其餘 → English），推斷失敗則 **繁體中文**。
4. **切換器**：topbar 小控制 **「繁體中文 | English」**（二選一）；切換後 `document.documentElement.lang` 同步為 `zh-Hant` 或 `en`。
5. **動態區塊**：`renderStatusLight`、`adviceFor`、`renderRecallPacket` 的**標題與空狀態**走 i18n；**pre 內 API 原文**不翻。

### Recall／Pending 顯示規則

| 元素 | 處理 |
|------|------|
| 區塊標題「L1」「Day chain」 | i18n |
| `pre` 內 L1 summary、chain markdown、what.md | **原文顯示** |
| `（無報告）`、`（無 day chain）` | i18n 空狀態文案 |
| `match_reason`（`keyword` 等） | 可選：顯示用 label map；**不**改 API 值本身 |

### API／技術識別子

- `dream_status`、`lock`、`empty`/`present` 在 **dt** 可保留英文 key（workbench 對照 API），旁邊 **dd** 或 advice 用翻譯說明。
- 或 dt 也 i18n 成「入夢狀態」但 dd 仍顯示 `pending_review` 原文——實作時擇一，文件寫入 `web/README.md`。

## 非目標

- **第三語系以上**（含簡體中文 `zh-Hans`）
- RTL、複數規則 ICU、lazy-load 語系包
- 依 browser 自動翻譯記憶內容
- Server-side i18n
- UI 以外的 CLI／workbench skill 多語（可 backlog）

## 測試要點

- 預設 **繁體中文**：主要流程字串完整
- 切 **English**：場景、按鈕、錯誤、advice 皆為英文；**recall 內容區**仍為 capture 原文
- 切換器只有兩項；`setLocale('fr')` 等非法值 fallback 繁體中文
- 重新整理後 locale 保留
- `lang` 屬性與當前語系一致（無障礙）

## 與 chain 雙軌的關係

獨立 workstream，可並行。Recall 若改讀 `*.summary.md`，區塊標題 i18n 不變；**summary 正文仍不翻**。
