# 0.36.0 — IA／版面（HOW）

做什麼以 [INDEX](../INDEX.md) 為準。本檔寫殼與兩頁的結構，避免實作 agent 猜 CSS 語意。

## 總佈局

```
+------------------+------------------------------+
| Engram           |                              |
|                  |         右欄內容區            |
|  事件            |                              |
|  搜索            |                              |
|  提問郵箱        |                              |
|  記憶            |                              |
|                  |                              |
| locale / status  |                              |
+------------------+------------------------------+
```

左欄寬度固定、可捲；右欄吃剩餘寬。窄屏：允許左欄收成 icon-only（若做，預設仍顯示文字；**不要**改成底部 tab bar）。

## Hash ↔ 左欄

| Hash | 左欄選中 | 右欄 |
|------|----------|------|
| `#/`、`#/activities` | 事件 | 事件頁，內 tab＝近期輸入 |
| `#/consolidate` | 事件 | 事件頁，內 tab＝沉澱入夢 |
| `#/seek` | 搜索 | SeekScene（不改內頁） |
| `#/clarify` | 提問郵箱 | Clarify DM |
| `#/memory…` | 記憶 | MemoryScene（不改內頁） |

切左欄「事件」預設寫 `#/activities`（push）。在事件頁點「沉澱入夢」→ `#/consolidate`（push）。點「近期輸入」→ `#/activities`。

## 事件頁

```
[ 發帖卡：composer ]
[ 插圖列 ]
[                    Post ]

[ 近期輸入內容 | 沉澱入夢 ]

tab 近期：STM 帖由新到舊（pool 檔序＝既有 append 序，**不要**自訂排序）
tab 沉澱：現有 consolidate 區塊（pending 報告、操作鈕、結構提示）原樣搬入
```

發帖與 0.32／0.29 相同：`POST /activities` `raw`；圖先 `POST /attachments/uploads` 再 embed。dream lock 時發帖 disabled（與現在相同）。

## 提問郵箱

```
+------------+---------------------------+
| 會話列表    | 選中則：對方問題           |
| asking[]   | 作答 textarea             |
|            | 送出／略過                 |
+------------+---------------------------+
| aside：你主動補充                       |
```

列表空＝沒有待釐清。選中 hash 可選：本版 **不強制** `#/clarify/{id}`（未寫進 INDEX 就不要發明）；用元件 state 即可。

aside 成功不寫 L0／STM（既有契約）。
