# 0.42.0 設計審查報告

← [INDEX](../INDEX.md) · [api-and-ui](./api-and-ui.md) · [reasoning](./reasoning.md) · [HANDOFF](../HANDOFF.md)

> **日期：** 2026-08-21（初審）· **併入已定案：** 2026-08-21  
> **對照基準：** 本版 INDEX 已定案 A–D、非目標、Track、驗收；GUIDELINES／agent-workflow；現行 `GET asking`、`ClarifyPendingItem`、`ActivitiesScene` 近期 tab、0.41 釐清快照  
> **範圍：** 只審文件自足與失敗模式。做什麼以 **INDEX／HOW 為準**；本檔留審查史料。  
> **結論（初審）：** 主幹可開工；H1／M1–M6 為 HOW 留白。  
> **結論（併入後）：** H1、M1–M6 已寫入 INDEX／`api-and-ui.md`；L1–L3 作 HOW 一句。開工前仍須拍板為空。本審查不改碼、不 commit。

---

## 1. 總評（對 GUIDELINES）

| 面向 | 判斷 |
|------|------|
| 標題／上游／狀態／產品句 | **夠**。`planned`；產品句含誰／得到什麼／邊界。 |
| 已定案 | **主幹完整句子**（A–D），非關鍵字堆。 |
| 非目標 | **夠硬**（history GET、混時間軸、改 distill／快照、第五左欄）。 |
| 驗收 | **可勾**；空 200、submit／aside／dismiss、兩區、extract 非 409、phases。 |
| 錨點 | **路徑對**（`clarify.ts` API／store、`ActivitiesScene`、`api.ts`、i18n、workbench）。 |
| 文件地圖／Track／對照 | **有**；與 0.41 對照正確（本版不改 pipeline）。 |
| reasoning | **該寫且已寫**（掛近期、含 aside、新 GET、不混排、禁本場夢文案、不改 `listPendingItems` 序）。 |
| 隱私 | HOW 例證為虛構 Harbor；**無** live 記憶正文。 |
| 開工前仍須拍板 | INDEX 已寫 **無** |
| Self-sufficient | 併入後：進 tab 載 pending、i18n 句、同分鍵、UI 不展示欄已鎖 |

厚度：單一新 GET＋一塊 UI＝偏小的中改；現有文件量合適。HANDOFF starter 已含 workflow 四要素（只認檔案、AGENTS→HANDOFF→INDEX、Track 序、沉默才問）。

---

## 2. 對 agent-workflow

| 檢查 | 現況 |
|------|------|
| INDEX 已定案、無待拍板混寫 | 通過 |
| HANDOFF 存在＋ paste-ready | 通過 |
| 雙向 backlog | 通過（`backlog/recent-input-clarify-pending.md` ↔ INDEX；backlog INDEX 已列 0.42） |
| 本審查 | 初審後規劃已併入 INDEX／HOW；報告本身仍不改碼 |

上游 0.41 仍 **in progress**：本版明確不改 distill／快照，可並行規劃；實作宜假設 0.41 契約已在（extract 中 GET 不 409、discard 不歸檔 pending）。若 0.41 未合入就測「extract 中 GET pending」，依 0.41 語意仍應 200（讀不拿 dream lock）。

---

## 3. Findings

狀態：**已併入**（2026-08-21）。修復已改 INDEX／HOW，勿只改本檔。

### HIGH

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| H1 | 進入近期 tab 必須載入 pending，不能只改 refresh 按鈕 | **已併入** | INDEX B6、Track B、驗收「不點 refresh」；HOW 點名 `useEffect`／`refreshL1`／`Promise.all`。 |

### MEDIUM

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| M1 | 鎖死區（2）i18n 句子 | **已併入** | HOW i18n 表；INDEX D3。 |
| M2 | `answered_at` 同分時 `id` 的方向 | **已併入** | INDEX C3：`answered_at` 降序、`id` 升序 `localeCompare`。 |
| M3 | API 有、UI 不展示的欄 | **已併入** | INDEX D2：不展示 `source_dream_run_id`、`related_nodes`。 |
| M4 | 無分頁、全列 live pending | **已併入** | INDEX C1＋非目標。 |
| M5 | 錨點補 type、workbench 四檔、domain-language | **已併入** | 錨點／Track B／C。 |
| M6 | phases：extract 中 GET pending | **已併入** | Track C、驗收、HOW 測試落點。 |

### LOW

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| L1 | 未知 query | **已併入** | INDEX C1：忽略多餘 query，不要 400。 |
| L2 | 壞檔跳過 | **已併入** | HOW：複用 `listPendingItems` skip 再另 sort。 |
| L3 | 未知 `kind` | **已併入** | INDEX D2。 |
| L4 | 0.41／0.39 仍 in progress 與開 0.42 | **可留** | 非本版契約；讀不拿 dream lock 在現碼已成立。 |
| L5 | 發帖成功 refresh | **已併入** | H1／B6 綁進既有 `refreshL1`。 |

---

## 4. 已對齊、仍成立（不必再拍板）

- 掛近期 tab、兩區不混、郵箱仍只 asking。
- 列 live `pending/`：prompt＋aside；不列 dismiss／history／asking。
- 消失＝approve 歸檔快照∩pending；discard／amend 不歸檔故仍顯示。
- 兩區獨立空態；區（2）唯讀。
- `GET /memories/clarify/pending`：200＋`items`；欄位對齊 `ClarifyPendingItem`；空 `[]` 非 404。
- 顯示序新→舊在 **handler／專用 list**；**不**改 `listPendingItems()` 的 `created_at` 升序（distill／0.41 快照）。
- GET **不**拿 `withClarifyWriteLock`、**不**因 `dream.lock` 409。
- 無新寫入端點、無 history GET、無 migrate、boot ≥0.40。
- Hash 不變；無第五左欄。
- 文案語意＝live pending 留給之後的夢，不是本場快照保證。
- 根 `GET /` endpoints 加 path；workbench helper `clarify-pending`。

現行碼對照：`handleClarifyListAsking` 無鎖、空 `{ items }`；`ClarifyPendingItem` 欄位已與 C2 一致；aside `answered_at`＝寫入時戳。實作應 **複製讀檔、在 handler 再 sort**，或新增 `listPendingItemsForApi()`，切勿改 pipeline 呼叫的 `listPendingItems`。

---

## 5. 驗收（初審建議 → 已併入 INDEX）

打開近期 tab 不點 refresh；STM 失敗不清空區（2）；i18n 禁本場夢句；phases lock 期間 GET pending 200。

---

## 6. 建議後續

開**新**實作 agent，貼 HANDOFF starter。本審查不改碼、不 commit。
