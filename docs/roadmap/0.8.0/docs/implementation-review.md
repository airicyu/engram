# Implementation review — 0.8.0 進行中的週記，以及日記空洞

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 1 輪**
- 角色：實作審查（不改程式）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)；[`../HANDOFF.md`](../HANDOFF.md)
- **總評：** 無未關閉 HIGH，無應修 MEDIUM。進行中週的同路徑短稿、收成後清掉 `open`、以及 distill job 的 `output.missing_days` 都落在 skill、契約與 program。`bun test` 退出沙箱後全綠（103 pass／0 fail）。L1 不擋驗收。INDEX 驗收框仍未勾，出貨時再勾。

## Findings

### HIGH

本輪無。

### MEDIUM

本輪無。

### LOW

| ID | 狀態 | 依據 |
|----|------|------|
| L1 | **非阻擋** | 驗收要隔離測試證明缺日只含本批首尾之間，且不產生 clarify 檔。`server/worker/missing-days.test.ts` 鎖了不可解析 `ts` 與中間洞（`2026-10-29`），並用 `mkdtemp`。它沒有斷言執行後沒有 `clarify/asking/`。`missingDaysInSpan` 只對 day 路徑做 `access`，`server/index.ts` 成功後才寫 `output.missing_days`，`catch` 不寫該欄。行為符合 INDEX #6、#7 與 `how.md`；測試沒鎖住「不產生 clarify」與「失敗不寫欄位」。 |

## 驗收對照

| INDEX 驗收句 | 結果 | 證據 |
|--------------|------|------|
| `engram-distill` 寫明：未結束的當週要整份寫同路徑短稿且 `open: true`；週結束後收成並清掉 `open`；月／年進行中仍不寫 | 通過 | `.agents/skills/engram-distill/SKILL.md` 升層表：當週同路徑短稿且 `open: true`，第一個標題仍是 `##` 題材；已結束整份收成並刪掉 `open`；明說寫週且週未結束則保留 `open`。月只在已結束或明說時寫，並跳過 `open: true` 週稿改讀 day。年優先月記，不讀進行中週稿。進行中月、年不改寫。收成刪掉「本週至今」與過程旁白。禁止第二檔名與檔尾 append。 |
| `engram-ask` 寫明：`open: true` 的週檔要說是本週至今，不當定稿 | 通過 | `.agents/skills/engram-ask/SKILL.md`「讀哪些」第 1 點：frontmatter `open: true` 時說明是本週至今的短稿，不是已收成的週記。`server/worker/pi.ts` 的 ask prompt 同步要求。 |
| `engram-clarify-generate` 寫明：缺日清單不是出題來源 | 通過 | skill「禁止」：不讀 `jobs/`，不把缺日清單當出題材料，不問「某日有沒有值得記的事」。`promptClarifyGenerate` 有同一句，且不附清單。 |
| `docs/data-spec.md` 寫明週檔可有 `open: true`，以及進行中週與收成規則 | 通過 | Memory chain：週檔可在 `##` 前加 frontmatter；`open: true` 為唯一機器標記；未結束當週寫同路徑短稿；結束後碰到該週（或短稿仍帶 `open` 且本批寫過其日檔）整份收成並刪掉 `open`。月跳過進行中週稿。年不讀該稿。缺日只進 job `output.missing_days`，不新建釐清題。 |
| `docs/api.md` 寫明 distill job 的 `output.missing_days` | 通過 | 成功的 distill job 另有升序 `YYYY-MM-DD` 陣列；無可解析日期時為 `[]`；失敗不寫；`output.text` 仍在；`ask` 沒有該欄。`Job.output` 型別為 `missing_days?: string[]`。 |
| `AGENTS.md` 升層閘門改為：進行中的週可寫短稿；進行中的月／年仍不寫 | 通過 | 架構規則第 5 點：進行中 ISO 週可在正式週記路徑寫短稿且 `open: true`；該週結束後下一次碰到的 distill 整份改寫並去掉 `open`。月／年僅在時段結束或使用者這次明說時寫。不寫進行中的月或年。 |
| 單元測試（隔離臨時目錄）：進行中週核對、已結束週不得留 `open`、缺日只含本批首尾之間且不產生 clarify 檔 | 通過（L1） | `distill-gate.test.ts`：`today` 為 `2026-10-31` 時，本批改過的 `2026-10-28` 要求較新且含 `open: true`；無標記仍是 gap。已結束的 `2026-W43-1019` 若仍帶 `open: true` 仍是 gap（`open: false`）；去掉 frontmatter 後週 gap 消失。未改到的進行中週日檔不構成 gap。`missing-days.test.ts` 用臨時目錄，區間外不掃，中間缺日記進清單。clarify 否定項見 L1。 |
| `bun test` 通過 | 通過 | 見下節。 |
| 測試與 demo 無真人記憶正文 | 通過 | 本版新增測試用 `mkdtemp` 與虛構短句（一事、一週、本週至今、收成）。未讀、未複製真人 store，未 reset `ENGRAM_STORE_DIR`。 |

非目標抽樣：program 不寫週記散文、不補 day 正文。缺日不進 `memories/`，clarify-generate 的 prompt 不附清單。月、年沒有「進行中必須寫檔」條件；`distillGaps` 只用已結束的週檔去抬月／年的 mtime。無第二份週記檔名。

## 測試結果

指令：倉庫根 `bun test`。未 reset 真人 `ENGRAM_STORE_DIR`。

- 沙箱：103 則中 5 則失敗，皆在 `server/git/store-git.test.ts`（`git init` 寫 `.git/hooks/` 出現 `Operation not permitted`）。與 0.8.0 改寫無關。
- 不受限權限重跑：**103 pass，0 fail**（26 檔，472 expect）。含 `server/worker/distill-gate.test.ts` 新增兩則，以及 `server/worker/missing-days.test.ts` 兩則。

## 修復追蹤

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| L1 | L | 非阻擋 | 缺日否定項與失敗 job 未另寫測試；實作已符合 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 第 1 輪 | 2026-11-17 | 無未關 HIGH，無應修 MEDIUM。L1 非阻擋。`bun test` 退出沙箱後 103 pass／0 fail。 |
