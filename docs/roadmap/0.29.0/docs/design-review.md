# 0.29.0 設計審查報告

← [INDEX](../INDEX.md) · [capture-and-appendix](./capture-and-appendix.md) · [reasoning](./reasoning.md)

> **日期：** 2026-08-09（初審）· **併入已定案：** 2026-08-10  
> **範圍：** 本版 `INDEX.md`、`docs/capture-and-appendix.md`、`docs/reasoning.md`；對照 GUIDELINES、現行 activities／store git／Event、0.28 vault  
> **結論（初審）：** 範圍清楚、單主題、主幹自足；HOW 留白與失敗模式須鎖。  
> **結論（併入後）：** **D1–D5、F1–F5、N1／N3 已寫入 INDEX 已定案（#7、#15–#21、#25、#28、#34、#36–#39、#41–#45 等）與 capture**；「開工前仍須拍板」為空。做什麼以 **INDEX／capture 為準**；本檔留審查史料。

---

## 1. 總評（初審）

| 面向 | 判斷 |
|------|------|
| 產品句／單主題 | **對** |
| 已定案完整度 | 初審時大致足夠；併入後 HOW／失敗模式已鎖 |
| 非目標／防膨脹 | **夠硬** |
| Track＋驗收 | **可勾** |
| 「開工前仍須拍板」 | 併入後為空 |

---

## 2. 範圍摘要

Track A–D：attachments API＋activities 擴充、Activities UI、dream／STM prompt、文件出貨。不新開 migrate hop；boot ≥0.28。

---

## 3–4. 原建議定案 → 已併入

| ID | 題 | 併入 |
|----|-----|------|
| D1 | `attachment_max_bytes`／`ENGRAM_ATTACHMENT_MAX_BYTES`，預設 10485760 | INDEX #34 |
| D2 | Housekeep 依目錄日 | INDEX #41 |
| D3 | DELETE query `?day=&filename=` | INDEX #37 |
| D4 | 上傳成功 **201** | INDEX #36 |
| D5 | Multipart **`file`** | INDEX #36 |
| F1 | move 後寫入失敗 → 搬回 tmp（best-effort） | INDEX #16 |
| F2 | path／filename 消毒 | INDEX #7 |
| F3 | 對稱只認精確 `![[path]]` | INDEX #19 |
| F4 | 重複 path → 400 | INDEX #21 |
| F5 | approve 才 commit | INDEX #43 |
| N1 | L0／STM raw＝最終稿；`attachments?` | INDEX #25 |
| N3 | 跨日／tmp 過期 → 400 | INDEX #45 |
| N2 | 定案編號整理 | 併入時已重編為 #1–#45 |

---

## 5. 已對齊項（初審即確認，仍成立）

Vault＝memories；embed 無 `/tmp`；appendix 僅 server；雙重 appendix→400；relationship／raw 必填；MIME 四種；無 HEIC；無張數上限；無 vision／WYSIWYG／reuse／機械 ledger；lock→409；刪 tmp 冪等 200。

---

## 6. 後續

- 實作完成後另寫 `implementation-review.md`（對照驗收）
- 本檔不再阻擋開工
