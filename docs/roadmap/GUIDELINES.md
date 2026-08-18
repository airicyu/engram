# Roadmap 寫作指南

← [AGENTS.md](../../AGENTS.md) · **開發節奏（多 agent／審查／HANDOFF／相間測試）：** [agent-workflow.md](./agent-workflow.md)

本檔規範如何寫 `docs/roadmap/`，讓 **另一個沒有對話紀錄的 agent** 也能正確開工。  
寫 roadmap 的 agent 與實作的 agent 常常不是同一個；**對話裡談過但沒寫進檔案的內容，對實作 agent 等於不存在。**

**怎麼開新 agent、何時 design-review／implementation-review、HANDOFF、Track 間自測** → 見 [agent-workflow.md](./agent-workflow.md)。本檔專注 **文件自足與 INDEX 結構**。

---

## 核心原則：Self-sufficient（強制）

Roadmap 是 **跨 agent 交接文件**，不是當下對話的備忘草稿。

| 要求 | 說明 |
|------|------|
| **自足** | 只靠本版 `INDEX`＋其連結的 `docs/`，新 agent 就能知道要做什麼、不要做什麼、怎麼驗收 |
| **禁止腦內省略** | 寫的人「知道那是什麼」不夠；讀的人必須不靠猜測也懂 |
| **禁止過短條目** | 不可只有幾個關鍵字（如「改 path」「加 API」）；每條須寫清 **改什麼、做成什麼樣子、邊界在哪** |
| **相關脈絡一併寫清** | 依賴的舊行為、要推翻的舊語意、對照的 API／檔案路徑，都寫在檔內或明確連結並摘要，勿假設讀者讀過某次 chat |
| **隱私** | **不要把真實的數據內容寫入到 roadmap**（見下節）；例證用虛構情節 |

### 自檢（寫完／開工前）

用這句問自己：

> **若一個新 agent 只讀這些檔、完全沒有我們的對話，會不會誤解或亂猜？**

若答案不是「幾乎不可能誤解」，就還沒寫夠——補句子，不要補暗示。

### 壞例子 → 好例子

| 壞（靠對話腦補） | 好（自足） |
|------------------|------------|
| Track：day 分組 | 將 `memory-chain/days/{id}.md` 遷到 `days/{YYYY-MM}/{id}.md`；API 仍用 `day_id`；行為與 0.10 等價 |
| 加 retry | `POST /dream/retry`，body `{ reason }` 必填；pending 時對同一凍結 scope 先 discard 再新 `run_id` extract |
| 不要 supersede | `pending_review` 時 `POST /dream/run` → `409 pending_review`；UI 移除無理由「入夢（取代）」 |

---

## 典型工作流

實際常見兩種節奏（皆可）：

```
A. 先談再寫
   與 agent 討論「想做什麼／怎樣才算本版 scope」
   → 寫入／更新 roadmap
   →（可另開）detail briefing → 再更新已定案／docs／reasoning
   → 開新 agent 實作

B. 先記再談
   先寫 rough（產品句 + 粗範圍 + 待拍板）
   → 之後再談 detail → 更新 roadmap
   → 開新 agent 實作
```

**無論哪種：實作前檔案必須已自足。**  
開新 agent 做 changes 是預期行為（context 較乾淨）；因此 **不能把定案留在舊 conversation。**

寫 roadmap 的 agent 若發現自己正用「我們剛說的那個」當指稱，必須改成檔內完整表述。

---

## 隱私（強制）

**不要把真實的數據內容寫入到 roadmap。**

`docs/roadmap/` 進產品 git，不是記憶庫。規劃／實作／審查 agent **禁止**把 live store（`ENGRAM_STORE_DIR`、`data/`、試用庫）裡的記憶正文寫進路圖。

| 可以寫 | 不可以寫 |
|--------|----------|
| 結構觀察（路徑、有無某類檔、API 欄位） | 從真人庫抄出的 summary／ledger／node／activity／clarify 原文或近原文 |
| 產品詞、契約、**虛構**好／壞例 | 可識別的生活情節：健康、關係、行程、店名、地址、雇主、家人 |
| 測試慣用假 id（如 `acme`、`harbor`） | 把使用者真實 node 的生平、關係或事件當例（即使 id 碰巧與 fixture 同名） |

說明失敗模式時，另造一組虛構人物／專案／地點。**不要**寫「讀了最近 N 天 live chain」後把讀到的內容貼進 INDEX／docs／reasoning／HANDOFF／審查報告。

---

## 生命周期

| 階段 | 產物 | 門檻 |
|------|------|------|
| 構想 | `backlog/*.md`（可較短，但仍須讓人看懂題目） | 非承諾 |
| 排程 | `docs/roadmap/X.Y.Z/INDEX.md`（可先 rough） | 有版本號與產品句 |
| Briefing | 更新 INDEX：已定案、非目標、驗收；需要時加 `docs/`、`reasoning.md` | **待拍板清空或標成非目標** |
| 開工 | — | **「讀完本版 roadmap 即可開工」**；無需依賴聊天紀錄 |
| 出貨 | 勾驗收；`version.md`／`changelog.md`／契約文件同步 | 狀態 → `shipped` |

Rough INDEX 允許暫時簡短，但 **進入實作前必須升格為自足稿**。  
「之後再談 detail」可以；**談完不更新檔案就開工**不行。

---

## INDEX 最低必要欄位

每版 `INDEX.md` 至少包含：

1. **標題**、上游版本、changelog／version 連結、**狀態**（`planned`／`in progress`／`shipped`）
2. **產品句**（一句：誰得到什麼、本版邊界）
3. **已定案**（題 → 決定；給實作 agent「勿再問、勿擅自改語意」）
4. **非目標**（防膨脹；可鏈 backlog）
5. **驗收**（可勾 checklist；寫清通過長什麼樣）
6. **錨點檔案**（改前必讀的程式／文件路徑 + 一句用途）

強烈建議（中型以上）：

- **文件地圖／閱讀順序**（「讀完即可開工」）
- **實作軌道**（Track）：每軌寫 **做什麼／不要做什麼／驗收**
- **與上一版對照**（行為差在哪）
- 未收斂題目用 **「開工前仍須拍板」** 表，**不要**與已定案混寫

狀態用語新檔統一：`planned` → `in progress` → `shipped`（舊檔不必回溯改名）。

---

## 文件分工

| 檔 | 職責 |
|----|------|
| **INDEX.md** | 做什麼、不做什麼、軌道、驗收（**WHAT**） |
| **docs/\*.md** | 路徑、管線、API／UI 契約細節（**HOW**） |
| **docs/reasoning.md** | 為何這樣定、反例、否決過的方案（**WHY**） |

INDEX 是範圍與定案的單一入口；細節可外鏈，但連結目標也必須自足，不能「詳見某次對話」。

---

## 何時需要 `reasoning.md`

Detail briefing 之後，若定案對後續判斷有影響，**應寫 reasoning**。  
Reasoning 對 AI 特別有價值：保留動機與反例，讓實作／改契約時有思考空間，減少「表面上換寫法、實際上踩了當初要防的坑」。

### 應該寫

- 否決或推翻舊文件／舊語意
- 討論過 ≥2 個方案並選定（寫清為何不選另一個）
- 定案靠 **反例／失敗模式** 撐住
- 擔心日後有人「好心改契約」卻不懂在防什麼

### 可以不寫

僅當內容 **trivial**，且寫 INDEX 的人有把握：

> **新開 agent 只讀 INDEX，也幾乎不可能誤解或猜錯。**

若只有「幾個字的 track 名稱」或隱含共識——**不算 trivial，要寫清楚或寫 reasoning。**  
不確定時：**寫。** 多一段 WHY 的成本，低於實作 agent 猜錯重做。

`reasoning.md` 開頭建議註明：做什麼以 INDEX／docs 為準；本檔只留 motivation／反例；若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 依複雜度選厚度

| 類型 | 最低文件 | 參考 |
|------|----------|------|
| 小改（單一行為、範圍極清） | 自足的 INDEX 即可；可不寫 reasoning | ≈0.10／0.12 |
| 中改（多端點或 API+UI） | INDEX + 1–2 份 docs | ≈0.6／0.8 |
| 大改（store／dream／chain 契約） | INDEX + docs + **reasoning** + 分 Track | ≈0.11 |

**厚度可省，自足不可省。** 再薄的 INDEX 也不能靠對話殘留。

---

## Backlog

- `backlog/`＝**尚未出貨**的構想，不是承諾範圍
- 條目仍應讓人看懂題意；極短 stub 須在排進 version 時寫完整
- 排進某版後：INDEX ↔ backlog **雙向連結**
- **出貨後**：從 `backlog/` **刪除**該條（含獨立 `.md`）；真相留在 `docs/roadmap/X.Y.Z/`。勿長期堆「已併入」殭屍列

---

## 寫作 agent 檢查清單

開工實作（或交給新 agent）前，確認：

- [ ] 不讀聊天紀錄也能執行本版
- [ ] 已定案每條都是完整句子／完整決定，不是關鍵字
- [ ] 非目標與範圍膨脹項已寫出或鏈到 backlog
- [ ] 驗收可客觀判斷（含關鍵 API／指令若已知）
- [ ] 錨點路徑正確
- [ ] 若有非顯設計取捨 → 已有 `reasoning.md`（或 INDEX 內等長的 WHY 段）
- [ ] 無「待拍板」殘留（否則狀態應仍為 planned，且標明不可開工）
- [ ] **無真實記憶內容**：例證皆虛構；未貼 live store 正文（見上方「隱私」）

---

## 實作完成時

- 勾驗收；狀態改 `shipped`
- 更新 `version.md`、`changelog.md`
- 若改了 API／操作邊界／詞彙：同步 `docs/api-docs/`、`AGENTS.md`、`docs/domain-language.md`（列進最後一軌較不易漏）
