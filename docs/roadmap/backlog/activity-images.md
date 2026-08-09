# Backlog — Activity 附圖（image／media）

← [backlog INDEX](./INDEX.md)

**狀態：** 構想補充；**本項尚未排程實作。**

## 題目

支援把 **圖片** 與 activity 一併記入：上傳或 **UI drag-and-drop**，檔案進 store 內約定目錄，並與 L0 event（及後續沉澱到的 md）關聯，供 dream／Seek／人讀使用。

## 產品方向：Obsidian 相容（2026-08-08 補充）

長遠目標：`memories/`（nodes、chain／day block、必要時 short-term 敘事）要能 **同時用 Obsidian 打開當 vault 閱讀**——不只 Engram UI。

因此附圖實作須對齊 Obsidian 的 markdown＋附件習慣，而不是另發明「只給 Engram API 懂」的 blob 協議。

| 面向 | 方向（構想約束，定案時再細化） |
|------|------|
| **Vault** | 人以 Obsidian 開記憶庫（或 `memories/`）能看到 node／chain 正文與圖 |
| **正文引用** | md 內嵌圖採 Obsidian 可解析寫法（優先 wiki `![[…]]` 與／或標準 `![](相對路徑)`；定案時選一種為 Engram 寫入規範，另一種可接受讀） |
| **檔案落地** | 圖進 store 內**固定相對目錄**（對齊 Obsidian「附件存放路徑」設定心智，例如 vault-relative `attachments/` 或 `media/`）；路徑穩定、可相對 note 解析 |
| **誰寫路徑** | Engram（API／dream）寫入 md 時用同一套相對連結；不依賴僅存在於 DB／jsonl、Obsidian 打不開的引用 |
| **L0 vs L2** | Activity 可先在 event 關聯檔案；**沉澱進 chain／node 後**，人在 Obsidian 看到的應是 md＋附件，而非只能打 API |

相關但不同項：[Node network 互動圖](./node-network-graph.md)＝Engram 內 graph GUI；本項＝**檔案層與 Obsidian vault 共存**。

## 現況（至 0.26）

- `POST /activities` body 僅 `raw`（+ 可選 `source` 等）；**無** multipart／media 欄位
- Activities UI 為文字 capture；store 無約定附件目錄或 event 內 asset 引用
- L2／chain 已是 markdown 檔（對 Obsidian 友好的起點）；**尚無**圖

## 待 brainstorm（定案前）

| 面向 | 待決 |
|------|------|
| **API** | 單次 multipart（raw + files）vs 先 `POST /media` 再 activity 引用 `media_ids` |
| **目錄名／佈局** | **研究定案（實作跟附圖版）：** `memories/_attachments/`（Obsidian vault＝`memories/` 時設定為 `_attachments`）。**0.28 不建立此目錄**（無 image support）。見 `docs/roadmap/0.28.0/` |
| **Embed 語法** | 只寫 `![[path]]`、只寫 `![](path)`、或寫入一種＋讀兩種 |
| **Event 形狀** | `events.jsonl` 是否仍要 `attachments[]`（機器用）＋ md 內連結（人／Obsidian 用）雙軌 |
| **UI** | Activities 拖放預覽、大小／格式限制 |
| **Dream／Ask** | agent 是否 vision 讀圖，或僅保留連結＋ caption；入夢時如何把圖引用寫進 draft md |
| **去重** | 同檔 hash 是否共用一實體、連結是否改寫 |
| **雙向** | 人在 Obsidian 手動加圖／改路徑時，Engram 是否須容忍、是否回掃（長遠；首版可只保證 Engram→磁碟相容） |

## 粗範圍（方向）

- 最小仍可：**一圖一 event**，檔落在約定 attachments 目錄
- **寫進記憶 md 時**必須留下 Obsidian 打得開的相對引用（見上表）
- 契約同步 `docs/api-docs/`；若動 `events.jsonl` 或 store 佈局 → bump `store_version`＋migrate

## 非目標（構想階段）

- 影片／大型 blob 離線同步
- 圖床 CDN
- 完整 Obsidian 外掛／雙向 sync 產品（首版以「開得了、看得到」為準）
- 本項不實作 network graph GUI
