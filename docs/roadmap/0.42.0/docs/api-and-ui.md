# 0.42.0 — GET pending 與近期兩區（HOW）

做什麼以 [INDEX](../INDEX.md) 為準。本檔寫 wire 與版面，避免實作 agent 猜欄位名或把兩區合成一條 feed。

## `GET /memories/clarify/pending`

無 query。成功永遠 **200**。

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "kind": "prompt",
      "created_at": "2026-08-21T12:00:00.000+08:00",
      "answered_at": "2026-08-21T12:05:00.000+08:00",
      "source_dream_run_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "related_nodes": ["harbor"],
      "question": "Harbor 合約是一年還是兩年？",
      "answer": "兩年，今年續約。"
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "kind": "aside",
      "created_at": "2026-08-21T13:00:00.000+08:00",
      "answered_at": "2026-08-21T13:00:00.000+08:00",
      "source_dream_run_id": null,
      "related_nodes": [],
      "question": null,
      "answer": "Harbor 窗口改到週三。"
    }
  ]
}
```

- `items` 由新到舊：`answered_at` **降序**，同分 `id` **升序**（`localeCompare`）。上例僅示欄位，不必當測試固定 id。
- **無** query／分頁；多餘 query **忽略**（與 asking GET 相同）。
- 例證為虛構；**不要**把 live store 正文貼進 roadmap 或測試註解以外的產品文件。
- 壞檔：與 `GET asking` 相同，跳過並 log，不要整表 500。handler 應複用 `listPendingItems` 的 skip，再 **另 sort**，勿改該函式預設序。

## i18n（鎖死語意；鍵名實作可微調，正文不要改語意）

| 用途 | zh-Hant | en |
|------|---------|-----|
| 區（1）小標 | 近期輸入的事件 | Recent events |
| 區（1）空 | 沒有尚未入夢的事件。 | No events waiting to be dreamed. |
| 區（2）小標 | 提問郵箱已答、尚未入夢 | Pending replies |
| 區（2）空 | 沒有等待之後入夢的釐清。 | No clarify replies waiting for a later dream. |
| aside 標 | 順帶補充 | Aside |
| 區（2）載入失敗 | 無法載入未入夢釐清。 | Could not load pending clarify. |

**禁止**出現：正在入夢、本場夢、這次會寫入。

## 近期 tab 結構

Hash 不變。composer／發帖／沉澱 tab **原樣**。

```
[ 發帖卡 ]

[ 近期輸入內容 | 沉澱入夢 ]

tab 近期：
  [ refresh ]

  ## 近期輸入的事件          ← i18n 小標
     STM articles 新→舊 或 該區空句

  ## 提問郵箱已答、尚未入夢   ← i18n 小標（en 可用 Pending replies）
     pending articles 新→舊 或 該區空句
```

- 區（2）`prompt`：問題區塊＋答案區塊（兩個 `MdBlock` 或等效）。**不**畫 `related_nodes` chip、**不**展示 `source_dream_run_id`。
- 區（2）`aside`：一眼能辨順帶補充（i18n aside 標），只有 `answer`。
- **不要**把 pending 插進 STM 陣列依時間混排。
- 進近期 tab 的 `useEffect`（現行只 `refreshL1`）必須改為同時抓 pending；refresh 按鈕與發帖成功後的 `refreshL1`／`Promise.all` 同綁。兩區分開 `useState`。

## Client

`engramApi.memories.clarify.listPending()` → 上述 GET。錯誤時區（2）顯示錯誤句，**不要**連區（1）一併清空（分開會話 state）。

## 測試落點

`server/src/cli/self-test.ts` 既有 0.30 clarify 段：submit／aside 後 GET pending；dismiss 後無該 id；approve 後快照內 id 不在 pending。另：dream lock 期間 GET pending → **200**。不要另開瀏覽器 E2E。
