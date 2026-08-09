# 0.29.0 實作審查報告

← [INDEX](../INDEX.md) · [HANDOFF](../HANDOFF.md) · [design-review](./design-review.md)

**初審：** 2026-08-10  
**複審：** 2026-08-10（H1–H2／M1–M4 主項；發現 H3 迴歸；`test:phases` 紅）  
**三審：** 2026-08-10（實作宣稱 H3＋M5–M7＋L1 已補）  
**四審（獨立核實）：** 2026-08-10 — 對碼＋`bun run test:phases` 再驗  
**對照基準：** 本版 INDEX 已定案／驗收  

**四審結論：** 初審 HIGH／MEDIUM／L1 **均已關閉**。H3（無附件仍 `validateAttachments`）碼與 Phase 9b 一致；skills／根 README／INDEX API／phases 加案例均到位。`test:phases` **全綠**（約 12s）。剩餘僅低優先可選項（L2–L4；AGENTS 未列 `GET /file`／housekeep）。**可以当真出貨；使用者同意後再 commit**（碼仍在 working tree，相對 `f6c97de`）。

---

## 1. 總評

| 面向 | 初審 | 複審 | 四審 |
|------|------|------|------|
| Track A（lock／校驗／move／appendix） | 大致；H1 | H1 修；**H3 迴歸** | **H3 已修** |
| Housekeep 自動 | 無 | 已修 | 維持 |
| Backlog 清理 | 未清 | 已修 | 維持 |
| `\|alias` | 不完整 | 併 H3 | **通過**（有／無附件；phases） |
| Track B／C | 對齊 | 對齊 | 對齊 |
| Track D 文件／skill | 多漏 | 部分 | **M5／M6／L1 已補** |
| `test:phases` | 綠 | **紅** | **綠** |

---

## 2. Findings — 四審狀態

### HIGH

| ID | 題 | 狀態 | 證據 |
|----|-----|------|------|
| **H1** | Submit 未全程 capture lock | **已修** | 有 `attachments`：整段 `withCaptureLock`（校驗→move→寫入） |
| **H2** | backlog 列未刪 | **已修** | backlog INDEX 無附圖列；`activity-images.md` 標 shipped |
| **H3** | 無 attachments 跳過校驗 | **已修** | `activities.ts` 無附件分支先 `validateAttachments` 再 `captureActivity`；Phase 9b `embed_without_attachment`／無附件 `|alias` 通過 |

### MEDIUM

| ID | 題 | 狀態 | 說明 |
|----|-----|------|------|
| **M1** | Housekeep 無自動入口 | **已修** | startup＋cron＋configurations |
| **M2** | `\|alias` | **已修** | validate 顯式拒；phases 有／無附件兩例 |
| **M3** | configurations | **已修** | max_bytes／tmp retention／housekeep 鍵 |
| **M4** | AGENTS 操作邊界 | **已修（主項）** | upload／DELETE tmp；遷移句無 planned。`GET /file`／housekeep 仍可選補一句 |
| **M5** | Skills | **已修** | workbench 表＋decision；activities-integration `attachments[]` |
| **M6** | README 附件一句 | **已修** | 根 README：`memories/_attachments/uploads/`（setup-wizard／server README 仍無一句——可選） |
| **M7** | Phases 覆蓋 | **已修** | `|alias`、HEIC、`file_too_large`、lock upload 409、真 housekeep 過期日 |

### LOW／備註

| ID | 題 | 狀態 |
|----|-----|------|
| **L1** | INDEX 列 `GET /file`、`POST /housekeep` | **已修**（#40／#41） |
| **L2** | 衝突檔名曾用 UTC | **已修**（四審後）：改 `nowIso`＋`compactStampFromIso`（有效 TZ／虛擬鐘） |
| **L3** | `mimeType` 參數未用 | **可留** |
| **L4** | `/status` 未暴露 attachment 設定 | **可留** |

---

## 3. 驗收對照（四審）

| INDEX 驗收項 | 結果 |
|--------------|------|
| 拖放／貼上→tmp；精確 embed | **通過** |
| relationship／雙重 appendix／對稱／重複／非法 path | **通過** |
| 無 attachments 卻有 embed → 400 | **通過** |
| `\|alias` → 400 | **通過** |
| 寫入失敗搬回 tmp | **碼有**（best-effort） |
| DELETE 冪等；上傳 201 | **通過** |
| lock → 409（activities＋upload） | **通過** |
| Housekeep 自動＋依目錄日 | **通過** |
| gitignore tmp；無每則 activity commit | **通過** |
| Dream prompt；無 migrate；version 0.29.0 | **通過** |
| backlog 列移除 | **通過** |
| `test:phases` | **通過** |

---

## 4. 測試（四審執行）

```text
cd server && bun run test:phases
→ ✅ All self-checks passed (through 0.29)
  （含 Phase 9b: attachments）
  約 12s
```

---

## 5. 修復追蹤

- [x] H1–H3  
- [x] M1–M7  
- [x] L1  
- [x] `test:phases` 全綠（四審複跑）  
- [ ] 使用者同意後再 **commit** 0.29  

---

## 6. 歷審摘要

| 輪 | 要點 |
|----|------|
| 初審 | 主線可用；lock／housekeep／backlog／文件有洞 |
| 複審 | 多洞已修；H3 無附件漏校驗 → phases 紅 |
| 三審 | 實作補 H3＋skills／README／phases／INDEX API |
| 四審 | 獨立核實通過；可出貨，待 commit |

---

## 7. 建議後續

1. 維持 INDEX `shipped`。  
2. 使用者要求時再 git commit 0.29（含本審查檔與未追蹤 `attachments*.ts`）。  
3. L3–L4／AGENTS 補 GET／housekeep／setup 一句皆非阻擋（L2 已對齊有效 TZ）。

**做什麼以 INDEX 為準**；本檔只追實作對定案的落差。
