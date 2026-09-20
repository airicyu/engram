# Design review — 0.3.1 Chain 日記文體

- 日期：2026-09-21（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`reasoning.md`](./reasoning.md)、[`HANDOFF.md`](../HANDOFF.md)
- 現行程式抽樣：`.agents/skills/engram-lite-distill/SKILL.md`；`docs/data-spec.md`（Memory chain／Pool 段）；`docs/api.md`（`/distill` 202、無文風 API）；`server/clarify-skill.test.ts`（distill 不擁有 asking，無文體字串契約）
- **總評：** **無未關閉 HIGH**；**審查門檻通過，可開工**。本版 INDEX 範圍（skill／data-spec 文案＋字串測）與 AGENTS 警世原則、0.3.0 非目標一致；現碼未達驗收屬預期實作缺口，非提案不可行。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

（本輪無。）

### MEDIUM

| ID | 本輪狀態 | 依據與建議 |
|----|----------|------------|
| **M1** | **仍開** | INDEX 驗收 #3／HOW 改檔表主要指向 Memory chain「分題材、寫成文」小節，**未明列**修正 `docs/data-spec.md` Pool 段 distill 摘要（現仍寫「必要時在 `clarify/asking/` 新建一題」）與 ingest 摘要（「釐清只由 distill 出題」）。二者與 0.3.0 已定案（distill **不**寫 asking、clarify-generate 另 session）及現行 distill skill 矛盾。實作若只補文體小節可能**通過狹義驗收 #3 仍留跨段分叉**。**建議（實作／HOW 備註，非改 INDEX）：** Track A 同步改 distill／ingest 摘要句，與 skill＋orchestration 同義；或將此列進實作 agent 自檢清單。 |
| **M2** | **仍開（實作缺口）** | 已定案 #3(a) 要求 skill 含**禁止口語粵語、聊天／網路腔**；現 skill「Chain 文體」與 data-spec 僅「繁體中文書面語」，無硬禁令句。屬 INDEX 已覆蓋、待實作，非設計衝突。 |
| **M3** | **仍開（實作缺口）** | 已定案 #4／驗收 #2：skill 缺 **Day／Week 好／壞** 虛構例句。現有獨立小節 `## Chain 文體（必須）` 已含 (b)–(f) 語意，缺例句與 (a) 硬禁令。 |
| **M4** | **仍開（實作缺口）** | HOW／已定案 #7 要求 **bun 字串契約測**（書面語禁令、文體小節標題、好／壞例標記）；倉庫現僅 `clarify-skill.test.ts` 等 distill 編排斷言，**無** 0.3.1 文體契約測。 |
| **M5** | **非阻擋** | INDEX #6：0.3.0 與 0.3.1 並行時 distill skill 文案合併風險；`reasoning.md` 失敗模式已寫。實作 agent 合併時須保留「不寫 asking／兩 session」句——設計已足，實作須自律。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| **L1** | 記錄 | HOW 未指定字串測檔名（新檔 vs 擴充 `clarify-skill.test.ts`）；不阻擋，實作自選即可。 |
| **L2** | 記錄 | 借鏡路徑 `../engram/...` 在本機 sibling 存在；若其他環境無 Engram，實作仍可依 HOW「語意借鏡」清單完成。 |
| **L3** | 記錄 | `docs/api.md` 無 chain 文風端點，與 INDEX 非目標一致；本版不改 HTTP，**無衝突**。 |

## 驗收對照

| INDEX 驗收句 | 設計層是否可測 | 缺口（設計／現況） |
|--------------|----------------|-------------------|
| distill skill 獨立「Chain 文體」小節且 (a)–(f) | 是（字串＋人工讀） | 現碼：有小節，缺 (a) 硬禁令與 #4 例句 |
| Day／Week 好／壞虛構例、無真人隱私 | 是 | 現碼：無例句區塊 |
| data-spec 文體段與 skill 同義、無第三套 | 是 | 文體段結構已近 skill；缺與 (a) 同義禁粵語句；**M1** 頂部 distill／ingest 摘要未納入驗收字面範圍 |
| 未新增 dream／雙檔 summary／server 文風引擎 | 是（消極：diff 範圍） | 提案與 HOW 已禁止；api／server 抽樣無相關端點 |
| `bun test` 全綠含字串契約 | 是 | 測試尚未撰寫（**M4**） |
| version／changelog（出貨） | 是 | 出貨步驟，非設計阻擋 |

## 與現碼抽樣

| 錨點 | 與 0.3.1 提案關係 |
|------|-------------------|
| distill `SKILL.md` | 已有獨立「Chain 文體（必須）」；步驟 5 仍指「文體見下」——與 INDEX「勿只散落步驟」並存可接受。缺例句與 zh-Hant 硬禁令。 |
| `data-spec.md` Memory chain | 分題／一段一拍／取捨／時間錨與 skill  largely 同義；L110 書面語無禁粵語。 |
| `data-spec.md` L89–91 | 與 0.3.0／distill skill **互斥**（asking 歸 clarify-generate）；實作 Track A 應一併修正（**M1**）。 |
| `docs/api.md` | `POST /distill` 202 → skill only；無文風 lint API。 |
| `server/pi.ts`（未全文） | 編排應仍控制面；本版不改 program——符合 INDEX。 |
| sibling `../engram/.../chain-prose.md` | 存在，HOW 借鏡可行。 |

**現碼未做本版 ≠ 設計 HIGH**（本輪無此類 HIGH）。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉條件／位置 |
|----|----|------|----------------|
| M1 | M | 仍開 | 實作同步 data-spec Pool 段與 clarify 編排；或父 agent 將一句補進 HOW（設計審查不改 HOW） |
| M2 | M | 仍開 | skill＋data-spec 含禁粵語／網路腔等價句 → 驗收 #1/#3 |
| M3 | M | 仍開 | skill 內 Day／Week 好壞例 → 驗收 #2 |
| M4 | M | 仍開 | 新增或擴充 `bun test` 字串契約 → 驗收 #5 |
| M5 | M | 非阻擋 | 合併 0.3.0 時手動確認 distill 編排句 |
| L1–L3 | L | 記錄 | — |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-21 | 無 HIGH；門檻通過可開工；M1–M4 為實作／文件同步待辦 |
