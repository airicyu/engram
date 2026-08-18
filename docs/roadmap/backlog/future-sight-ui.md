# Backlog — 未來視 UI 翻閱

← [backlog INDEX](./INDEX.md) · **未排程**（**不**在 [0.39.0](../0.39.0/INDEX.md)）

## 題目

工作台要有一個**給人掃讀**的未來視畫面：列出近程前瞻錨點（`hot`／`later`），可點進單則正文。現況資料與讀 API 已在，UI 幾乎沒有專屬翻閱。

## 現況（0.39 進行中時）

| 層 | 狀態 |
|----|------|
| Store | `memories/future-sight/hot.md`＋`later.md`；入夢前 script 過期／重桶；`GET` 只清過期 |
| API | `GET /memories/future-sight` 回 `anchors[]`（先 hot 近→遠，再 later）、`zone`、`anchor_start`／`anchor_end`、`content`；空＝`anchors: []`（200） |
| 尋問 | Search `scope` 含 `future`；Ask 恆可讀 hot＋later（0.34） |
| 記憶頁 | 僅 **鏈**（列表）與 **節點**（圖）；`hashRoute` 的 `MemoryHash` 只有 `chain`／`nodes` |
| 左欄 | 四項：事件／尋問／提問郵箱／記憶；**無**獨立「未來視」項 |

人若要看「接下來 30 天／一年窗內有哪些錨」，只能靠 Search 撞到、Ask 問起、或開 Obsidian 讀兩檔。沒有對等於記憶鏈列表的瀏覽。

## 粗範圍（將來定案）

只讀、沿用既有 GET。**不要**為本項新開寫入端點；錨點仍由入夢／maintain 寫入。

| 面向 | 選項（待拍板） |
|------|----------------|
| **掛哪** | Memory 第三 mode（與鏈／節點並列）；或 Seek 內頁一欄；**預設不要**第五左欄項（0.36 四項殼） |
| **Hash** | 若掛 Memory：例如 `#/memory/future`、`#/memory/future/{id}`（id＝錨點 `id`）；須同步 `hashRoute` |
| **版面** | 左列表（時間＋預覽＋ zone）＋右正文；hot／later 分組或單一時間線加標籤 |
| **空狀態** | 無錨＝200 空列表＋一句導語，與其他讀取型頁一致（勿 404） |
| **過期** | 開頁打現有 GET 即可（expire-only）；**不要**在 UI 假裝可重桶 |

虛構例（非 live）：列表可見「熱：下週北灣拍照」「較遠：十二月檔期」兩則；點選後右欄是該錨 markdown／純文，不是 Ask 答句。

## 非目標（構想階段）

- 改 `hot.md`／`later.md` 路徑或分桶規則；改 `future_sight_window_days`／`hot_days` 語意
- 人手在 UI 新增／編輯／刪錨（無對應寫 API；本項不是編輯器）
- 歷史過期錨瀏覽（GET 會清過期；過期進 L0 系統事件，不屬本畫面）
- 記憶鏈橫向 strip、節點圖改版（見 [memory-chain-strip](./memory-chain-strip.md)、[0.37.0](../0.37.0/INDEX.md)）
- Vector 搜尋（見 [vector-semantic-search](./vector-semantic-search.md)）

## 錨點（排程時必讀）

| 路徑 | 用途 |
|------|------|
| `docs/api-docs/api.md` → `GET /memories/future-sight` | 回傳欄位與 GET 副作用（expire＋可 git commit） |
| `web/src/scenes/MemoryScene.tsx` | 現有鏈／節點切換 |
| `web/src/lib/hashRoute.ts` | Memory hash 僅 chain／nodes |
| `docs/domain-language.md` | 未來視 vs 記憶鏈 vs Seek |
| `docs/roadmap/0.36.0/docs/ia.md` | 左欄四項；Memory 內頁才加 mode |
