# Backlog — AI 反思與認知補問（reflective prompts）

← [backlog INDEX](./INDEX.md)

## 題目

目前記憶主循環是 **人寫 activity → 入夢 consolidate → L2 nodes／chain**。資訊流向單向：系統被動消化使用者說過的事。

構想：AI 也可 **反思** 既有 nodes、chain、activities，找出理解上的缺口、矛盾或想進一步釐清之處，向使用者 **提出問題或建議**；使用者作答後，再經既有（或稍加延伸的）流程 **補完認知**。

一句話：**不只等人說，系統也能說「我想搞懂這件事」**。

## 現況（0.24）

| 面向 | 現況 |
|------|------|
| **Capture** | 全由使用者 `POST /activities` 發起 |
| **Consolidate** | dream extract 消化 short-term／rollup；不產「待答問題」 |
| **Seek** | `GET /memories/search`、`POST /memories/ask` — **使用者問、系統答** |
| **Store** | 無「認知缺口／待答提示」的第一類結構 |

## 粗範圍（方向，實作前再設計）

1. **反思來源**：讀哪些材料？（node `what.md`、chain day summary、近期 activities、跨 node 關聯…）
2. **產出**：問題 vs 建議 vs 兩者；一則提示應多具體、多短
3. **觸發時機**：入夢後副產物、定期掃描、使用者開啟某場景時、手動「幫我想想還缺什麼」…
4. **呈現與互動**：UI 放哪（Activities 旁、Consolidate、Memory node 詳情、獨立 inbox）；可 snooze／dismiss 嗎
5. **閉環**：使用者回答是否一律走 `POST /activities`（加 `source`／關聯 id）；還是需要專用「答覆」類型，讓 dream 知道在補哪一題
6. **邊界**：頻率與勿騷擾；提示須標明依據（哪個 node／哪段 chain），避免假裝已知

## 待 brainstorm（定案前）

| 面向 | 待決 |
|------|------|
| **產物形狀** | 獨立 pending-questions 佇列 vs node 附屬 metadata vs short-term 特殊 note |
| **Agent** | 獨立 job vs dream extract 副產物 vs Ask 管線變體 |
| **追溯** | 問題 ↔ 觸發 node／event ↔ 使用者答覆 ↔ 更新後 `what.md` 如何連起來 |
| **API** | 新端點（list／dismiss／answer）vs 僅契約化 `source` + activities |
| **與 Seek 分工** | 本構想是 **系統問人**；Seek 仍是 **人問系統** — UI 與 mental model 如何不混淆 |

## 非目標（構想階段）

- 系統未經使用者確認自動改 L2
- 取代使用者自發 capture（仍是主輸入）
- 通用 chatbot 式嘮叨、無依據的追問

## 錨點（開工前再讀）

- 記憶循環：`AGENTS.md`（activities → dream → memory）
- Seek 契約：`docs/api-docs/api.md`（search／ask）
- Node 認知：`memories/nodes/{id}/understand/what.md`
- 早期 activation `gap` 語意（檢索截斷）：`docs/roadmap/0.1.0/docs/activation.md` — **不同概念**，但「承認不知道」的誠實原則可參考
