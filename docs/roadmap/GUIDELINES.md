# Roadmap 寫作指南（engram-lite）

← [AGENTS.md](../../AGENTS.md) · 節奏：[agent-workflow.md](./agent-workflow.md)

本檔規範如何寫 `docs/roadmap/`，讓 **另一個沒有對話紀錄的 agent** 也能正確開工。  
寫 roadmap 的 agent 與實作的 agent 常常不是同一個；**對話裡談過但沒寫進檔案的內容，對實作 agent 等於不存在。**

寫作原則對齊完整 Engram 的 `docs/roadmap/GUIDELINES.md`；路徑與出貨檔以 **本倉庫** 為準（lite **沒有** `store_version` boot gate、沒有 `docs/api-docs/`）。

**架構警世（根目錄強制）：** 見 [`AGENTS.md`](../../AGENTS.md)「調度寫死在 program，把判斷還給 skill」——roadmap／Track 不得把語意判斷（文體、開 node、出釐清題）寫成 server 規則引擎；program 只准控制面與機械 I／O。控制面管線須有 WHY：見 [`docs/architecture/orchestration.md`](../architecture/orchestration.md)。

---

## 核心原則：Self-sufficient（強制）

Roadmap 是 **跨 agent 交接文件**，不是當下對話的備忘草稿。

| 要求 | 說明 |
|------|------|
| **自足** | 只靠本版 `INDEX`＋其連結的 `docs/`，新 agent 就能知道要做什麼、不要做什麼、怎麼驗收 |
| **禁止腦內省略** | 寫的人「知道那是什麼」不夠；讀的人必須不靠猜測也懂 |
| **禁止過短條目** | 不可只有幾個關鍵字；每條須寫清 **改什麼、做成什麼樣子、邊界在哪** |
| **隱私** | **不要把真實記憶正文寫入 roadmap**；例證用虛構情節 |

自檢：若一個新 agent 只讀這些檔、完全沒有我們的對話，會不會誤解？答案必須是幾乎不可能。

---

## 生命周期

| 階段 | 產物 | 門檻 |
|------|------|------|
| 構想 | `backlog/*.md` | 非承諾 |
| 排程 | `docs/roadmap/X.Y.Z/INDEX.md` | 有版本號與產品句 |
| Briefing | 已定案、非目標、驗收；需要時加 `docs/`、`reasoning.md` | **待拍板清空或標成非目標** |
| 開工 | — | **讀完本版 roadmap 即可開工** |
| 出貨 | 勾驗收；`version.md`／`changelog.md`／契約同步；**清 backlog** | 狀態 → `shipped` |

狀態：`planned` → `in progress` → `shipped`。

---

## INDEX 最低必要欄位

1. 標題、上游、changelog／version 連結、**狀態**
2. **產品句**
3. **已定案**
4. **非目標**
5. **驗收**（可勾）
6. **錨點檔案**

中型以上加：文件地圖、Track、與上一版對照、開工前仍須拍板（不要與已定案混寫）。

| 檔 | 職責 |
|----|------|
| **INDEX.md** | WHAT |
| **docs/\*.md** | HOW |
| **docs/reasoning.md** | WHY（否決方案、失敗模式） |

小改：自足 INDEX 即可。大改（store 形狀）：INDEX＋reasoning＋分 Track。

---

## Backlog

- 尚未出貨的構想，不是承諾
- 排進某版後雙向連結；**出貨後刪獨立 `.md` 與表列**
- 真相只留在 `docs/roadmap/X.Y.Z/`

---

## 實作完成時

- 勾驗收；狀態改 `shipped`
- 更新根目錄 `version.md`、`changelog.md`
- 清 backlog
- 若改契約：同步 `docs/data-spec.md`、`docs/api.md`、`AGENTS.md`、相關 skills

## 本專案補充

- version／changelog：根目錄 `version.md`、`changelog.md`（對齊 Engram 檔名，不是 `VERSION.md`）
- 執行某版：`.agents/skills/roadmap-version`（預設先設計審查閘門；測試 `bun test`）
- 禁止把 `demo-engram-lite-data/` 以外的真人日記當例寫進 roadmap
- Lite **不** bump 記憶庫 `store_version`、**不**做 Engram migrate hop
