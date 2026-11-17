# Design review — 0.7.0 節點別名與 Ask 點名

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（初審同日，見文末歷審；本輪不沿用初審對話，只認檔）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[how.md](./how.md)；[reasoning.md](./reasoning.md)；HANDOFF：**缺**（`docs/roadmap/0.7.0/HANDOFF.md` 不存在；依節奏在閘門之後才寫，不當成設計缺陷）
- 現行程式抽樣：`.agents/skills/engram-ask/SKILL.md`、`.agents/skills/engram-distill/SKILL.md`、`docs/data-spec.md` Nodes／pool `raw`／ask 段、`docs/roadmap/0.6.1/INDEX.md`、`docs/roadmap/backlog/node-aliases-and-ask.md`（構想，非本版契約）、`AGENTS.md` ask 列
- **總評：** 無未關閉 HIGH，無仍開 MEDIUM。提案可行。初審 M1–M4、L1–L3 皆已寫進 INDEX 與 HOW，且彼此一致。審查門檻通過。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

無。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | INDEX #7 與 HOW「Ask」同寫：唯一命中才讀全文；多於一個主檔命中則列出 id 並詢問，不併讀。驗收亦寫「多名命中只列 id 並詢問」。 |
| M2 | **關閉** | INDEX #6 與 HOW「Distill」同寫：空殼刪除呼叫與刪除相同的腳本（改純文字並刪目錄）；只針對本批開始前已存在的檔；本批 `node-create` 骨架同一輪不得刪。與 0.6.1「必須建檔」可並存。 |
| M3 | **關閉** | 驗收已列：`AGENTS.md` 的 ask 列改為點名才讀該主檔，不再寫「不要讀 nodes」。現碼仍是舊句，屬出貨前改寫，不是設計缺口。 |
| M4 | **關閉** | INDEX #5 與 HOW 腳本輸入同寫：`pending.jsonl` 只替換連結子字串，該行仍須是合法 JSON，其餘欄位不動。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | INDEX #3：skill 確認四節已寫入後自行刪從檔目錄；腳本 merge 模式不刪檔。HOW 同句。 |
| L2 | **關閉** | INDEX #4／#5 與 HOW：帶 `\|顯示名` 與無 pipe 兩種都改。合併無 pipe 改成主檔路徑；刪除無 pipe 換成 id 文字。 |
| L3 | **關閉** | INDEX #7 與 HOW：比對鍵含第一個 H1。INDEX #6：本次使用的顯示名若不在 `aliases` 則寫入。 |

本輪無新 HIGH／MEDIUM。`aliases` 字串清單、掃描邊界、不改 `clarify/` 與 `archived.jsonl`、純 CLI 不觸發 store git，INDEX／HOW／reasoning 一致。判斷留在 skill，改寫是固定字串腳本，無新 HTTP、無 UI 合併、無 `merged_into`。

## 驗收對照

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| `engram-node` 寫明：只在使用者指名時合併或刪除；合併收四節、寫 `aliases`、改寫連結、刪從檔 | 可測（skill 條文＋隔離目錄腳本測） | 無（L1 已寫死 skill 刪目錄） |
| 機械改寫：合併只換路徑、顯示名不變；刪除改純文字；不碰 `clarify/` 與 `archived.jsonl`；單元測試 | 可測 | 無（JSONL 合法性在 #5／HOW，不另開驗收缺口） |
| distill 沿用 `aliases`，以及空殼再碰到仍無事實則刪檔 | 可測（skill 契約測試） | 無（#6 已排除本批 create 骨架） |
| ask：唯一命中才讀全文；多名命中只列 id 並詢問；零命中要明說；不掃未命中的 node 正文 | 可測 | 無 |
| `docs/data-spec.md` 記載 `aliases` 與掃描邊界 | 可測 | 無 |
| `AGENTS.md` 的 ask 列改為點名才讀該主檔 | 可測（對照該列文句） | 無 |
| `bun test` 通過 | 實作期 | 設計階段無測試缺口 |
| 測試與 demo 無真人記憶正文 | 可測（人工／diff 自檢） | 無；本審查未貼真人正文 |

## 與現碼抽樣

現碼未做本版，不計為設計 HIGH。

| 現況 | 與提案 |
|------|--------|
| 無 `engram-node` | 本版要新增；不衝突 |
| Ask skill 與 data-spec ask 段、`AGENTS.md` 仍寫不要讀 `nodes/` | 出貨時改寫；驗收已點名 `AGENTS.md`（M3 關閉） |
| Distill 無 `aliases`、無空殼刪除；0.6.1 create 必須建骨架 | 提案疊加；#6 規定本批骨架同一輪留下（M2 關閉） |
| data-spec Nodes 無 `aliases`；有可選 `activity_score` 且 distill 不維護 | 與非目標「Distill 不維護 activity_score」一致；`aliases` 是本版要補的契約 |
| Server 無合併 API；store git 只在 server 列舉寫入後 commit | 與已定案 #1、#8 一致 |
| backlog 寫 Ask「不讀 future-sight」 | 構想已過時；INDEX #7 與現行 ask skill 都讀 `upcoming.md`／`longTerm.md`。以 INDEX 為準 |

硬契約抽樣：合併／刪除／別名判斷在 skill；改寫是固定字串腳本；無 UI、無新 HTTP、無 `merged_into`、無 dream staging。未見把寫作規則放進 server。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | 關閉 | INDEX #7；HOW「Ask」；驗收 ask 句 |
| M2 | MEDIUM | 關閉 | INDEX #6；HOW「Distill」 |
| M3 | MEDIUM | 關閉 | 驗收 `AGENTS.md` 列 |
| M4 | MEDIUM | 關閉 | INDEX #5；HOW 腳本輸入 |
| L1 | LOW | 關閉 | INDEX #3；HOW merge 模式 |
| L2 | LOW | 關閉 | INDEX #4／#5；HOW 兩種 wikilink |
| L3 | LOW | 關閉 | INDEX #6／#7；HOW「Ask」比對鍵含 H1 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-11-17 | 可行；無 HIGH；M1–M4 仍開；L1–L3 非阻擋。HANDOFF 缺。 |
| 第 2 輪複審 | 2026-11-17 | 可行；M1–M4、L1–L3 皆關閉。無未關 HIGH、無仍開 MEDIUM。門檻通過。HANDOFF 仍缺，不當缺陷。 |
