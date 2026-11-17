# Design review — 0.8.0 進行中的週記，以及日記空洞

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（初審同日，見文末歷審）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`reasoning.md`](./reasoning.md)、[`../HANDOFF.md`](../HANDOFF.md)
- 現行程式抽樣：`engram-distill`／`engram-ask`／`engram-clarify-generate` 的 `SKILL.md`、`server/worker/distill-gate.ts`、`docs/data-spec.md`、`docs/api.md`、`AGENTS.md`（現碼未實作本版，不計設計 HIGH）
- **總評：** 提案可行，無未關閉 HIGH。初審同意的 M1、M2 已寫進已定案與 HOW／reasoning。審查門檻**通過**。

產品硬契約仍成立：live memories 由 skill 寫；program 只做日期快照、缺日比對與檔案核對；無 dream staging／approve／report、無 setup wizard。

## Findings（第 2 輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

無。本輪無新 HIGH。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | 已定案第 4b 條；HOW「進行中週記」；reasoning 跨月段 |
| M2 | **關閉** | 已定案第 6 條；HOW「缺日」；reasoning 末段 |

#### M1 — 跨月週稿會變成月記來源 — **關閉**

已定案第 4b 條寫明：寫已結束月記時跳過 frontmatter `open: true` 的週檔，那些日子改讀 day；年記仍優先讀月記，不另讀進行中週稿。HOW 與 reasoning 同一句。與現行 `docs/data-spec.md`「月記優先讀週記」的差異是本版要改的讀檔規則，不是未決分叉。

#### M2 — 缺日清單的空池與失敗語意分叉 — **關閉**

已定案第 6 條寫明：只取池內可解析 `ts`；池與 clarify 都空而早退，以及池空但 clarify 仍跑完，成功的 job 皆寫 `missing_days: []`；整份 job 成功才寫，失敗不寫；`output.text` 仍保留。HOW、reasoning 對齊。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | 已定案第 4 條末句；HOW「進行中週記」末段 |
| L2 | **關閉** | 已定案第 6 條「`output.text` 仍保留」；HOW「`output.text` 維持不變」 |
| L3 | **關閉** | 併入第 6 條與 HOW：解析失敗的 `ts` 不進區間 |

本輪無新 LOW。

## 驗收對照（第 2 輪）

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| distill：未結束當週同路徑短稿且 `open: true`；收成清 `open`；月／年進行中仍不寫 | 可 | 無。月記跳過 `open` 週檔在第 4b 條，實作寫進 skill 與 data-spec 時一併帶上 |
| ask：`open: true` 說本週至今、不當定稿 | 可 | 無 |
| clarify-generate：缺日清單不是出題來源 | 可 | 無 |
| `docs/data-spec.md` 寫明 `open: true` 與收成 | 可 | 無（現行 spec 仍禁開週，屬預定置換） |
| `docs/api.md` 寫明 `output.missing_days` | 可 | 無。`text` 並存已寫進第 6 條 |
| `AGENTS.md` 升層閘門 | 可 | 無 |
| 單元測試：進行中週、已結束週不得留 `open`、缺日只含本批首尾且不產生 clarify | 可 | 無。失敗不寫欄位、池空只剩 clarify 寫 `[]` 已在第 6 條 |
| `bun test` | 實作期 | 設計不擋 |
| 測試與 demo 無真人記憶正文 | 可 | 無 |

## 與現碼抽樣（第 2 輪）

現碼未做 0.8.0，不計為設計 HIGH。抽樣確認沒有與提案互斥、且 INDEX 未點名的隱藏規則。

| 現況 | 與提案 |
|------|--------|
| `docs/data-spec.md` 與 distill 升層：進行中的週不寫；月記優先讀重疊週記 | 驗收與第 4b 條要求置換。實作前契約仍是舊規則 |
| `docs/api.md` 的 job `output` 現為文字欄 | 第 6 條加 `missing_days`，`text` 保留 |
| 錨點 skill 與 `distill-gate.ts` 尚無 `open`／`missing_days` | Track 1–3 要做的事 |

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | 關閉 | 已定案第 4b 條；HOW「進行中週記」；reasoning 跨月段 |
| M2 | MEDIUM | 關閉 | 已定案第 6 條；HOW「缺日」；reasoning 末段 |
| L1 | LOW | 關閉 | 已定案第 4 條；HOW「進行中週記」 |
| L2 | LOW | 關閉 | 已定案第 6 條；HOW「缺日」 |
| L3 | LOW | 關閉 | 已定案第 6 條；HOW「缺日」（併入 M2） |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-11-17 | 可行；無 HIGH；M1、M2 未關，門檻未過 |
| 第 2 輪 | 2026-11-17 | 可行；M1、M2、L1–L3 關閉；無未關閉 HIGH；門檻通過 |

---

## 初審紀錄（保留）

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**初審**
- **總評（當時）：** 提案可行，無未關閉 HIGH。審查門檻尚未通過：M1、M2 仍開。

產品硬契約（skill 寫 live memories、program 只做機械核對、無 dream staging／approve／report、無 setup wizard）與已定案第 9 條、非目標一致。

## Findings（初審）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

無。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **仍開** | 已結束的月可以讀到跨月、仍帶 `open: true` 的週稿，INDEX／HOW 未寫這時月記的讀檔規則 |
| M2 | **仍開** | `missing_days` 在「池空但 clarify 仍跑」與「哪一次算成功才寫清單」兩處，INDEX 與 HOW 沒對齊 |

#### M1 — 跨月週稿會變成月記來源 — **仍開**

ISO 週可跨月。現行契約是月記優先讀重疊週記，沒有週記才退回日檔（`docs/data-spec.md`、distill skill）。0.8.0 讓尚未結束的週提前有檔，且正文可含「本週至今」。該月若已結束、該週尚未結束，下一次 distill 必須寫月記，讀檔時會先碰到這份短稿。短稿涵蓋下個月那幾天，口吻也還是未收成。

這與 WHY「已收成的層才當定稿」相鄰，但不是兩條已定案互相否定，所以不升 HIGH。不寫死的話，實作會沿用「有週檔就讀週檔」，月記主路徑會吃進半成品。

建議寫進已定案與 HOW（擇一，本審查不定案）：寫已結束月記時，跳過 frontmatter `open: true` 的週檔，那些日子改讀 day。年記若只經月記，不必另開一條。

#### M2 — 缺日清單的空池與失敗語意分叉 — **仍開**

已定案第 6 條：快照只取 `pool/pending.jsonl` 的 `ts`；池與 clarify pending **都空**而早退時 `missing_days` 為 `[]`。HOW 寫「沒有 pending 日期（空池早退）則 `[]`」，把「池裡沒有日期」和「早退」綁成同一句。

現行編排（`server/worker/pi.ts`）是池與 clarify **合計**為 0 才早退。池空、clarify pending 仍在時，session A 仍會跑，但池的 min／max 不存在。INDEX 沒寫這個結果；實作可能漏欄位，或誤去掃 clarify 擴大區間（第 6 條與 HOW「不讀 clarify 來擴大區間」都不允許）。

HOW 另寫「失敗則不寫清單覆蓋；成功才寫」。INDEX 只說「完成後」。現行 job 在 session A 之後還有 session B。session A 已寫好 day、session B 失敗時，清單算不算寫，兩邊都沒講死。

建議寫進已定案與 HOW：只從池的可解析 `ts` 取區間；池沒有可解析日期時（含早退，以及只剩 clarify）成功結束的 job 寫 `missing_days: []`。清單在整份 distill job **成功**後寫入；job 失敗不寫 `missing_days`。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | 仍開 | 點名寫當週、但本批沒有改寫日檔時，HOW 的 mtime 核對不會觸發。已定案第 9 條把 program 限在檔案條件，第 4 條的點名仍由 skill 履行。HOW 宜補一句：program 不從使用者語句判斷「有沒有點名」。 |
| L2 | 仍開 | `docs/api.md` 現況 `output` 只有 `text`。提案是「放入 `output.missing_days`」，語意是加欄位。驗收改 api 時應寫明 `text` 仍在，避免型別改成只剩陣列。 |
| L3 | 仍開 | 無法解析的 `ts` 未定義。可併進 M2 的「只取可解析日期」。 |

## 驗收對照（初審當時）

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| `engram-distill` 寫明未結束當週同路徑短稿且 `open: true`；結束後收成並清 `open`；月／年進行中仍不寫 | 可（skill 契約文字＋檔案核對測試） | 無 |
| `engram-ask` 寫明 `open: true` 要說本週至今、不當定稿 | 可（skill 契約文字） | 無。週已結束但檔尚未收成時仍依標記說「至今」，與第 8 條一致 |
| `engram-clarify-generate` 寫明缺日清單不是出題來源 | 可（skill 正文＋prompt 不附清單） | 無。非目標已禁止為空洞出題 |
| `docs/data-spec.md` 寫明 `open: true` 與收成規則 | 可 | M1 未寫月記讀檔是否跳過未收成週稿 |
| `docs/api.md` 寫明 `output.missing_days` | 可 | M2、L2 |
| `AGENTS.md` 升層閘門改為進行中週可寫短稿；月／年仍不寫 | 可 | 無 |
| 單元測試：進行中週核對、已結束週不得留 `open`、缺日只含本批首尾且不產生 clarify 檔 | 可 | M2 的失敗路徑與「只剩 clarify」未列入驗收句；預設隨 M2 補一句即可，不另開驗收空洞 |
| `bun test` 通過 | 實作期 | 設計不擋 |
| 測試與 demo 無真人記憶正文 | 可 | 無 |

## 與現碼抽樣（初審當時）

現碼未做 0.8.0，不計為設計 HIGH。

| 現況 | 與提案 |
|------|--------|
| `distill-gate.ts` 只在 `week.end < today` 時要求週檔較新 | 提案改為：未結束週改寫過 day 則週檔須較新且含 `open: true`；已結束週須較新且不得含 `open: true`。是本版要改的核對，不是互斥的隱藏規則 |
| `AGENTS.md` 第 5 條與 `docs/data-spec.md`「仍在進行中的週不要改」 | 驗收已要求改寫。實作前契約仍禁開週，與提案方向相反，屬預定置換 |
| distill skill 升層表：本週未過完且沒人點名就不寫週 | 同上，Track 1 要改 skill |
| `engram-ask` 未提 `open` | Track 3 |
| `engram-clarify-generate` 未提缺日清單 | Track 2；現況也沒有清單可讀，不衝突 |
| job `output` 型別為 `{ text: string }`；`docs/api.md` 範例相同 | 加 `missing_days` 即可並存（L2） |
| 早退條件是池與 clarify 合計為 0 | 與第 6 條的早退 `[]` 一致；池空但 clarify 仍跑是 M2 |
| `web/` 無 dream report／approve／wizard | 本版不新增這些 UI |

## 修復追蹤表（初審當時；現行狀態見上方）

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | 仍開 | 待寫：已定案（月記讀檔）＋ HOW「進行中週記」或另段 |
| M2 | MEDIUM | 仍開 | 待寫：已定案第 6 條＋ HOW「缺日」 |
| L1 | LOW | 仍開 | 可寫 HOW「Program 核對」 |
| L2 | LOW | 仍開 | 可寫 HOW「缺日」／日後 `docs/api.md` |
| L3 | LOW | 仍開 | 可併入 M2 |

## 歷審摘要（初審當時；現行見上方）

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-11-17 | 可行；無 HIGH；M1、M2 未關，門檻未過 |
