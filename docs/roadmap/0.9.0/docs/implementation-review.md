# Implementation review — 0.9.0 一題一事實，答了就要吸收

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 1 輪**
- 角色：實作審查（不改程式）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)；[`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)
- **總評：** 無未關閉 HIGH。配額、跳過原因與 pending 離檔核對已落在 skill、契約與 program。M1 已由實作改指向 0.9.0。`bun test` 退出沙箱後全綠（107 pass／0 fail）。狀態維持 `in progress`，尚未出貨。

## Findings

### HIGH

本輪無。

### MEDIUM

| ID | 狀態 | 依據 |
|----|------|------|
| M1 | **關閉**（實作修） | 生題 skill 與 `docs/architecture/orchestration.md` 的契約句已改指向 0.9.0，並寫明 0.3.0 已定案 #5 的下限與 retry 不再適用。 |

### LOW

| ID | 狀態 | 依據 |
|----|------|------|
| L1 | **非阻擋** | 驗收要求空白值算 gap。`clarifyHistoryMarkerGap` 對 `absorbed_at` 與 `dismissed_because` 同一套 trim。測試只寫了 `dismissed_because: '  '`，沒有另寫只有空白的 `absorbed_at`。 |
| L2 | **非阻擋** | `clarifyQuotaResult(0, 空白)` 會丟「no skip reason」。實際 Session B 先經 `lastAssistantText`，空白回覆改丟「pi empty assistant text」。兩條都讓 job 失敗，且不寫 `clarify_skip_reason`。 |

## 驗收對照

| INDEX 驗收句 | 結果 | 證據 |
|--------------|------|------|
| `engram-clarify-generate` 寫明：一題一事實；0–5 且 5 是上限；沒有缺口時用一句原因跳過；已答過的缺口不要再問 | 通過（M1） | skill 描述為 0–5。步驟 4：一題一個能寫進 day 或 node 的事實；有缺口才寫 1–5。步驟 5：沒有缺口不寫檔，回覆只留一句。步驟 6：鏈、節點或 `history/` 已有的缺口不再問；半答殘段另開一題且不得複製舊題幹。開頭仍引用 0.3.0 #5，見 M1。 |
| `engram-distill` 寫明：每份 pending 以 `absorbed_at` 吸收或 `dismissed_because` 捨棄並移到 `history/`；半答只寫答到的事實，仍算吸收；不要發明未答部分 | 通過 | 步驟 2：能寫成事實則寫 day／node、加 `absorbed_at`、不寫 `dismissed_because`；不能寫成事實則不發明正文、加 trim 後非空的 `dismissed_because`。半答只寫答到的事實，仍移走，本輪不補開 asking。客觀吸收判準重述二擇一。 |
| `docs/data-spec.md` 與 `docs/architecture/orchestration.md` 不再要求至少三題或生題 retry | 通過（M1） | data-spec asking 列：有缺口 1–5、5 是上限，沒有缺口則 0 題。history 列分開寫 distill 的 `absorbed_at`／`dismissed_because`，以及 DELETE 仍只寫 `dismissed: true`。orchestration 流程改為計本輪新增、沒有第二輪 retry；0 題且回覆非空則寫 `clarify_skip_reason`。殘留的 #5 引用見 M1。 |
| `docs/api.md` 記載 `output.clarify_skip_reason` | 通過 | 成功 distill 範例含該欄。正文：Session B 新建 0 題且回覆非空才寫 trim 後整段；1–5 題或沒跑 Session B 則不帶。`Job.output` 為可選字串。`server/index.ts` 只在 `result.clarifySkipReason` 有值時寫入。 |
| `AGENTS.md` 把 clarify-generate 寫成 0–5，不再強制 3–5 | 通過 | Skills 表：write 0–5 one-fact questions，5 is the ceiling；無事可沉澱則跳過該 session。 |
| 隔離臨時目錄單元測試：只核對 Session A 開始前就在 `clarify/pending/` 的 id；仍在 pending 是 gap；history 只有非空 `absorbed_at` 或只有非空 `dismissed_because` 不是 gap；兩鍵、都沒有、或只有空白是 gap；不在該清單的 history（含只有 `dismissed: true`）不是 gap。生題 prompt 與 skill 正文不再要求至少三題 | 通過（L1） | `distill-gate.test.ts` 用臨時目錄。`cla_test` 只帶 `absorbed_at` 後 gap 消失。`cla_pending`：仍在 pending、history 無鍵、雙鍵、`dismissed_because` 只有空白皆為 gap；只有 `dismissed_because: no fact` 則該 id 不再是 gap。同輪已在 history、只有 `dismissed: true` 的 `cla_deleted` 不進 gap。`clarify-quota.test.ts`：0 題要非空原因並 trim；1 與 5 不帶 skip；6 題失敗。prompt 含 at most 5、Zero is allowed，且不含 MIN／at least 3。`clarify-skill.test.ts` 對 skill 斷言一題、1–5、不要寫檔、舊題幹，並斷言 `pi.ts` 沒有 `CLARIFY_GENERATE_MIN`。測試不呼叫 live model。空白 `absorbed_at` 見 L1。 |
| `bun test` 通過 | 通過 | 見下節。 |
| 測試與 demo 無真人記憶正文 | 通過 | 本版新增斷言用 `mkdtemp` 與虛構短句（問？、No askable gap.、no fact）。未讀、未複製真人 store，未 reset `ENGRAM_STORE_DIR`。 |

非目標抽樣：program 不分類題目或答案是否足夠。`clarifyQuotaResult` 只看新建檔數（asking 之後減之前）與回覆是否非空，不刪多餘檔，也不合成原因。早退（蒸餾前 work 為 0）不設 `clarify_skip_reason`，且不開 Session B。有 work 且 Session A 成功才開一次 Session B。DELETE asking 的 handler 不在本版 diff。Ask 仍不讀 `clarify/`。

## 測試結果

指令：倉庫根 `bun test`。未 reset 真人 `ENGRAM_STORE_DIR`。

- 沙箱：107 則中 5 則失敗，皆在 `server/git/store-git.test.ts`（`git init` 寫 `.git/hooks/` 出現 `Operation not permitted`）。與 0.9.0 改寫無關。
- 不受限權限重跑：**107 pass，0 fail**（27 檔，493 expect）。含 `server/worker/distill-gate.test.ts` 的 history 標記則，以及 `server/worker/clarify-quota.test.ts` 兩則。

## 修復追蹤

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| M1 | M | 關閉（實作修） | skill 與 orchestration 改指向 0.9.0；寫明 0.3.0 #5 的下限與 retry 不再適用 |
| L1 | L | 非阻擋 | 空白 `absorbed_at` 未另寫測試；函式與 `dismissed_because` 同一路徑 |
| L2 | L | 非阻擋 | 空白回覆仍讓 job 失敗，錯誤字串不同 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 第 1 輪 | 2026-11-17 | 無未關 HIGH。應修 M1。L1、L2 非阻擋。`bun test` 退出沙箱後 107 pass／0 fail。 |
