# 0.30.0 實作審查報告

← [INDEX](../INDEX.md) · [HANDOFF](../HANDOFF.md) · [queues-and-pipeline](./queues-and-pipeline.md) · [design-review](./design-review.md)

**初審：** 2026-08-11  
**修復／複審：** 2026-08-11  
**對照基準：** 本版 `INDEX.md` 已定案／驗收（衝突時 INDEX 勝）；HOW 輔讀 `docs/queues-and-pipeline.md`；Critical invariants 見 `HANDOFF.md`

**複審結論：** 初審 **H1** 與同意的 **M1–M5** 已關。`bun run test:phases` 複跑 **全綠**（含 submit／dismiss／restore 白名單）。INDEX 驗收已勾、狀態 **shipped**。**可以出貨；使用者同意後再 commit。**

---

## 1. 總評

| Track | 初審 | 複審 |
|-------|------|------|
| **A** Store＋契約＋兩 job＋approve／retry | 主線對齊；**H1** 白名單洞 | H1 已修（snapshot restore＋CLI nodes-only writable）；M2／M3 已修 |
| **B** Web ClarifyScene＋Consolidate | 五場景＋UI | 不變／通過 |
| **C** 文件／skill／version | 過早 shipped／死鏈 | M4／M5 已對齊；INDEX shipped |
| **`test:phases`** | 綠 | **綠**（含 submit／dismiss） |

---

## 2. Findings

### HIGH

| ID | 題 | 狀態 | 證據／說明 |
|----|-----|------|------------|
| **H1** | Distill 白名單剔除不完整 | **已修** | `snapshotDraftMemories`＋`stripClarifyDistillViolations` 還原既有非 node 主檔改寫／刪除；`CliClarifyDistillAgent` writableRoots＝`draft/.../nodes`＋workDir。單元測 `strip restores modified pre-existing non-main files`。 |

### MEDIUM

| ID | 題 | 狀態 | 證據／說明 |
|----|-----|------|------------|
| **M1** | phases 缺 submit／dismiss | **已修** | Phase 0.30 種子 asking → submit → dismiss |
| **M2** | generate 落盤後整夢失敗未回滾 | **已修** | `finalizeDreamReport` 納入 clarify try；失敗 best-effort 刪 `clarifyGeneratedIds`＋commit rollback |
| **M3** | 未強制 3–5 | **已修** | `0 < n < MIN` 整批不落盤 |
| **M4** | 文件過早 shipped | **已修** | INDEX → shipped 與 AGENTS／backlog 對齊（審查通過後） |
| **M5** | INDEX 死鏈 | **已修** | 文件地圖改指向 implementation-review；來源句改「已刪」 |

### LOW

| ID | 題 | 狀態 | 說明 |
|----|-----|------|------|
| **L1** | Distill create 無 meta | **可留／非缺陷** | 已定案只准主檔 |
| **L2** | phases 未明示 amend | **可留** | 碼路徑正確 |
| **L3** | 16KiB phases | **可留** | |
| **L4** | distill reports 可寫 | **可留** | CLI 已收窄；mock 仍靠 strip |

---

## 3. 驗收對照（複審）

INDEX 驗收 checklist **全部通過**（見 INDEX 已勾）。

---

## 4. 測試（複審）

```text
cd server && bun test src/dream/clarify/distill.test.ts src/store/memories/clarify.test.ts
→ 11 pass

cd server && bun run test:phases
→ ✅ All self-checks passed (through 0.30)
```

---

## 5. 修復追蹤

- [x] **H1** Distill 白名單／writableRoots
- [x] **M1** phases submit／dismiss
- [x] **M2** generate 落盤後失敗回滾 asking
- [x] **M3** server 拒絕 `<3`（非空批次）
- [x] **M4** 文件狀態對齊 shipped
- [x] **M5** INDEX 死鏈
- [x] L1–L4 可留
- [x] `test:phases` 複審全綠
- [ ] 使用者同意後再 **commit** 0.30

---

## 6. 歷審摘要

| 輪 | 要點 |
|----|------|
| **初審** 2026-08-11 | 主線可用、phases 綠；H1 擋 shipped；M1–M5 待修 |
| **複審** 2026-08-11 | H1／M1–M5 已關；phases 綠；INDEX shipped |

---

## 7. 建議後續

無阻擋項。使用者同意後再 git commit。

**做什麼以 INDEX 為準**；本檔只追實作對定案的落差。
