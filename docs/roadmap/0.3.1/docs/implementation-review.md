# Implementation review — 0.3.1 Chain 日記文體質感

- 日期：2026-09-21（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（只認檔案；不改產品碼、不 commit、不貼真人記憶正文）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`reasoning.md`](./reasoning.md)、[`../HANDOFF.md`](../HANDOFF.md)；契約 [`../../../data-spec.md`](../../../data-spec.md)；根 [`../../../../AGENTS.md`](../../../../AGENTS.md)
- 抽樣錨點：`.agents/skills/engram-lite-distill/SKILL.md`、`docs/data-spec.md`（`## Memory chain`／`### 分題材、寫成文`）、`server/chain-prose-contract.test.ts`、`server/clarify-skill.test.ts`（distill 不寫 asking）、`version.md`、`changelog.md`
- **工作樹註記：** 與 `origin/main` 相比含大量 **0.3.0** 產品碼（server／web／demo）同批未提交；**本報告範圍僅 0.3.1 INDEX**（文案／契約／字串測／出貨文件）。0.3.1 新增檔（含本檔、`chain-prose-contract.test.ts`、roadmap 0.3.1 目錄）目前多為 **untracked**，內容已在磁碟可審。

---

## 總評

| 閘門 | 結果 |
|------|------|
| 未關閉 HIGH | **無** |
| `bun test` | **全綠**（49 pass／0 fail／13 files；Bun 1.3.14；`export PATH="$HOME/.bun/bin:$PATH" && bun test`） |
| INDEX 驗收（0.3.1） | **六項均可確認**（見下表；根 README／AGENTS 版本句另見 MEDIUM） |
| 未 commit | **正常**（依 HANDOFF） |

**可否就 0.3.1 出貨敘事：建議可接受**（skill／data-spec／契約測／version＋changelog 已對齊 INDEX；無 server 文風引擎、無 dream 雙檔）。**未關 MEDIUM：2**（入門文件版本與 clarify 一句話，不擋 0.3.1 契約本身）。

---

## `bun test` 紀錄

```
bun test v1.3.14 (0d9b296a)

server/chain-prose-contract.test.ts:
(pass) distill skill: independent Chain 文體 section with zh-Hant bans and examples
(pass) data-spec: chain prose aligned with distill; distill does not own asking

…（其餘 11 files，含 0.3.0 軌道測試）

 49 pass
 0 fail
 292 expect() calls
Ran 49 tests across 13 files. [237.00ms]
```

本版閘門相關：`chain-prose-contract.test.ts` 兩測全過；`clarify-skill.test.ts` 仍斷言 distill 不擁有 asking 生成。

---

## 驗收對照（INDEX §驗收）

| # | INDEX 驗收句 | 結果 | 證據 |
|---|--------------|------|------|
| 1 | distill 有**獨立**「Chain 文體」小節，涵蓋 (a)–(f) | **通過** | `SKILL.md` `## Chain 文體（必須）`：書面語／禁粵語聊天網路 (a)；分題／禁逗號併題 (b)；一段一拍／禁逗號牆 (c)；週月年取捨／合訂本 (d)；時間錨 (e)；整份取代／首行 `##`／禁旁白 (f) |
| 2 | Day／Week 好壞例虛構；無真人隱私 | **通過** | `#### Day — 壞／好`、`#### Week — 壞／好`；明示「虛構角色甲／乙」、捏造店專案；Week 壞例為合訂本敘述（等價對照） |
| 3 | `data-spec` 與 skill **同義** | **通過** | `分題材、寫成文` 段：書面語禁令、外層生命線、段落一拍、海拔表、合訂本／七篇、時間錨；clarify 段 distill 不寫 asking、clarify-generate 另 session |
| 4 | 未新增 dream／雙檔 summary／server 文風引擎 | **通過** | `data-spec` 仍「每層一個 markdown」；server 無 chain 文風 lint（僅 `chain-prose-contract.test.ts` 讀檔斷言） |
| 5 | `bun test` 全綠＋字串契約 | **通過** | 見上節 |
| 6 | `version.md`／`changelog.md` 出貨更新 | **通過** | `version.md`＝`0.3.1`；`changelog.md` `## 0.3.1 — Chain 日記文體質感（2026-09-21）` 含 skill／data-spec／新測 |

---

## 重點核對（任務錨點）

### distill skill — Chain 文體獨立小節

- 小節位於步驟／升層閘門**之後**，標題 `## Chain 文體（必須）`，非埋藏在步驟 5 內文。
- zh-Hant：列舉禁「食飯／睇報告／搞掂」等口語粵語、聊天腔、網路梗。
- 好／壞例：Day 有 fenced markdown；Week 好有 fenced markdown；Week 壞為 prose 描述合訂本（符合 INDEX「或等價對照」）。

### data-spec — 同義與 clarify 編排

- Memory chain 正文語言句與 skill 語言小節同向。
- Skills 小節：`distill` **不要** `clarify/asking/`；ingest／events 不生題；clarify 表 `asking` 只由 `engram-lite-clarify-generate` 新建。
- 測試：`chain-prose-contract.test.ts` 第二測＋ `expect(md).not.toMatch(/釐清只由 distill 出題/)`。

### `chain-prose-contract.test.ts`

- 斷言：`/## Chain 文體/`、口語粵語禁止、聊天／網路、Day／Week 四標題、一段一拍或逗號牆、distill 不含 `clarify/asking.*新建一題`。
- **未**斷言 (e)(f) 關鍵字（時間錨、過程旁白）→ 見 **IR031-L2**（skill／data-spec 已有，非閘門缺口）。

### version／changelog

- 已 bump 0.3.1 並記 changelog；與 INDEX `shipped` 敘事一致。
- 根 `AGENTS.md`／`README.md` **未**同步現行版本與 0.3.1 連結 → **IR031-M1**。

---

## Findings

穩定 ID 前綴 **IR031-**；關閉＝已修或本輪不成立；仍開＝應追蹤。**不重編號。**

### HIGH

（無）

未發現：server 文風規則引擎、dream staging／`*.summary.md` 雙檔、distill skill 重新擁有 asking 生成、或與 INDEX 第三套文風衝突。

### MEDIUM

#### IR031-M1 — 根入門文件版本句落後 `version.md` — **仍開**

- **現象：** `version.md` 已 `0.3.1`；`changelog.md` 已有 0.3.1 條目；`docs/roadmap/0.3.1/INDEX.md` 標 `shipped`。但 `AGENTS.md` L6 仍寫「`version.md` 現行仍為 **0.2.0**」且下一版僅指 **0.3.0**（`planned`）；`README.md` L5 同樣「仍 **0.2.0**」且只連 0.3.0 INDEX。
- **為何 MEDIUM：** 不影響 distill 執行契約，但 agent／新人會誤判出貨版本與 roadmap 狀態；與 0.3.1 出貨文件不同步。
- **建議：** 出貨整理時更新 AGENTS／README 現行版本為 0.3.1，並調整「下一版／落地中」指標（0.3.0 若已 shipped 則改連結／狀態）。**非本審查修改範圍。**

#### IR031-M2 — README 釐清一句與 clarify 編排矛盾 — **仍開**

- **現象：** `README.md` L5「釐清是輕量郵箱（**distill 出題**、HTTP 落答案）」；契約真相為 program 第二 session **`engram-lite-clarify-generate`** 寫 `asking`，distill **不**出題（`data-spec`、`distill` SKILL、`clarify-skill.test.ts`）。
- **為何 MEDIUM：** 與 0.3.0／0.3.1 已定案編排衝突，易誤導運維／文件讀者；**非** data-spec／distill skill 本體錯誤。
- **建議：** 改為「distill 後 clarify-generate 出題」或同等句。**非本審查修改範圍。**

### LOW

| ID | 狀態 | 說明 |
|----|------|------|
| IR031-L1 | **仍開** | INDEX 可選 `docs/architecture/chain-prose.md` 未新增；skill 已指 `data-spec`＋自身小節，可接受省略。 |
| IR031-L2 | **仍開** | 字串契約測未覆蓋「時間錨」「過程旁白」等 (e)(f) 關鍵字；INDEX #7 最低門檻已滿足，加斷言可防回歸。 |
| IR031-L3 | **仍開** | Week — 壞 無 fenced 例句（僅 prose）；INDEX 允許等價對照，質感略弱於 Day 雙 fenced。 |

---

## 硬契約抽樣（0.3.1 非目標）

| 檢查 | 結果 |
|------|------|
| 語意判斷在 skill／data-spec，不在 TypeScript 文風引擎 | 符合 |
| distill 不寫 `clarify/asking/` | SKILL 步驟 7、description、契約測 |
| 無 Engram prompt 檔進 runtime | 未新增 `server/prompts/*` 依賴 |
| 例句虛構、報告未引用 demo 真人正文 | 符合 VIP |

---

## 修復追蹤表

| ID | 級 | 狀態 | 備註 |
|----|----|------|------|
| IR031-M1 | M | 仍開 | AGENTS／README 版本與 roadmap 指標 |
| IR031-M2 | M | 仍開 | README「distill 出題」→ clarify-generate |
| IR031-L1 | L | 仍開 | 可選 chain-prose 索引文 |
| IR031-L2 | L | 仍開 | 契約測可加 (e)(f) |
| IR031-L3 | L | 仍開 | Week 壞例可補 fenced（非必須） |

---

## 輪次紀錄

| 輪次 | 日期 | 摘要 |
|------|------|------|
| 初審 | 2026-09-21 | 對照 INDEX 六項驗收通過；`bun test` 49/49；HIGH 無；MEDIUM×2（根文件）；LOW×3 |
