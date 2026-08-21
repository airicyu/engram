# Backlog — 近期輸入內容展示未入夢釐清

← [backlog INDEX](./INDEX.md) · **未排程**（勿塞進進行中的 [0.41.0](../0.41.0/INDEX.md)）

## 題目

「近期輸入內容」應讓人看見**下一場入夢才會沉澱**的輸入，不只事件。Submit／aside 進 `clarify/pending/` 後，提問郵箱只列 asking，近期頁只列短期記憶 pool，已答內容在 UI 上暫時消失。

## 現況（至 0.41 契約）

- 事件頁 tab「近期輸入內容」只 `GET /memories/short-term-memory`（pool；UI wire 仍可能用 `l1` 別名）。
- 提問郵箱只 `GET /memories/clarify/asking`。Submit → pending（問+答）；aside → pending（`kind: aside`，無系統問句）；dismiss 真刪、不進 pending。
- **沒有** `GET` pending／history（0.30 非目標）。Distill 讀 pending；approve 把本場釐清快照∩仍在 pending 者歸檔 `history/`。
- 入夢中途／`pending_review` 仍可 submit／aside（0.41）；新寫入不進本場快照，留給下一場。

## 構想範圍（將來定案）

事件頁「近期輸入內容」內**分兩區**（不要混成一條時間軸）：

1. **近期輸入的事件** — 現有 STM feed。
2. **提問郵箱已答、尚未入夢** — 列出 live `pending/`：submit 的問與答，以及 **aside**（否則順帶補充同樣從郵箱消失卻仍會進下輪 distill）。Dismiss 不出現。

Approve 歸檔後，該則應從第 2 區消失（對齊事件從 pool 清掉）。提問郵箱頁仍只負責未答 asking，不當歷史匣。

實作需新增讀取 API（例如 `GET /memories/clarify/pending`；空 → `200` `{ "items": [] }`）。欄位至少：`id`、`kind`（`prompt`｜`aside`）、時間（prompt 用 `answered_at`、aside 用 `created_at`）、`question`（aside 可無）、正文／`answer`、`related_nodes`。**無** store migrate。

## 非目標（構想階段）

- Dismiss／「不要再問」黑名單；改 generate 選材或最低則數
- `GET` history；在郵箱頁做已答列表
- 改 distill／approve 歸檔語意
- 把釐清 uuid 塞進 activity `scope[]`
