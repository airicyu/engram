# Design review — 0.3.2 Store git

- 日期：2026-09-21（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[INDEX](../INDEX.md) 已定案＋驗收；[HOW](./how.md)、[reasoning](./reasoning.md)、[HANDOFF](../HANDOFF.md)
- 現行程式抽樣：`server/index.ts`、`server/pi.ts`、`server/jobs.ts`、`server/paths.ts`、`.agents/skills/engram-lite-reset/scripts/reset-store.ts`；契約 `AGENTS.md`、`docs/data-spec.md`、`docs/api.md`；上游 [0.3.1 INDEX](../../0.3.1/INDEX.md)、[0.3.0 非目標](../../0.3.0/INDEX.md)
- **總評：** 無未關閉 HIGH。**設計審查門檻通過，可開工**（建議實作前或 Track C 同步收斂下列 MEDIUM，非阻擋閘門）。

## Findings（本輪）

### HIGH

（本輪無。）

### MEDIUM

| ID | 狀態 | 標題 | 說明與建議 |
|----|------|------|------------|
| M1 | **仍開** | Pi-only vault 寫入是否 commit | 產品句寫「每一次成功寫入」，已定案 #1 只列 **server 機械寫入**與 distill job／reset script，未寫明：使用者僅用 pi-agent 跑 `engram-lite-ingest`／`engram-lite-distill`（不開 server）時 **不**自動 commit 是否為本版範圍。與「skills 不負責 git」一致，但與產品句字面可能落差。**建議**在 INDEX 已定案 #1 或非目標加一句：本版 commit 掛點僅 program／server 列舉路徑＋reset script；純 CLI skill 直寫 vault 不在範圍（或若要做，另列掛點）。 |
| M2 | **仍開** | `optional`／`built-in` 混用 | 已定案 #8 寫 AGENTS「**optional**／**built-in** store git」，未說明是否可關閉（env 旗標）或恆常啟用。**建議**寫死：預設每次成功寫入皆 commit、無開關；或明訂關閉方式。 |
| M3 | **仍開** | 既有 store `.gitignore` 合併 | `demo-engram-lite-data/.gitignore` 為 `jobs/*.json`；已定案 #3 要求以 store 根 `.gitignore` **寫死**排除 `jobs/`。`reset-store.ts` 的 `KEEP_ROOT` 保留 `.gitignore`。HOW 僅「寫入／合併」，未寫與既有條目衝突時規則。**建議** HOW 或 INDEX 一句：合併時必保 `jobs/`（整目錄）被忽略，不破壞使用者自加條目。 |
| M4 | **仍開** | `docs/api.md` 與驗收對齊 | 已定案 #8「必要時 api 一句」；INDEX 驗收未單列 api.md。**建議**驗收加一項或 #8 改「必更新 api.md 副作用一句」，避免出貨漏契約。 |

### LOW

| ID | 狀態 | 說明 |
|----|------|------|
| L1 | **仍開** | HANDOFF 寫 `commitOp`，HOW 寫 `commitStore`；實作時統一命名即可。 |
| L2 | **仍開** | INDEX 釐清寫 `DELETE`（dismiss），與 `docs/api.md` `DELETE /clarify/asking/{id}` 一致；無需改，僅供實作對照。 |

## 驗收對照

| INDEX 驗收句 | 設計層是否可測 | 缺口 |
|--------------|----------------|------|
| 空 store 首次 `POST /events` 後 `.git`＋message `engram-lite: …` | 是 | 依 HOW `ensureStoreGit`＋掛鉤；現碼未實作 ≠ 設計問題 |
| 再一次成功寫入 → 新 commit | 是 | — |
| `jobs/` 不在 `git ls-files` | 是 | 見 M3 與 demo 現有 `jobs/*.json` 條目 |
| distill job 成功終態 → commit | 是 | HOW 與 reasoning 已定「一 job 一次」；`server/pi.ts` 兩 session 編排不變 |
| clarify submit／aside → commit | 是 | `DELETE` dismiss 已定案 #1，驗收未單列 dismiss；建議實作測試涵蓋三類 |
| git 失敗不回滾；測試可證業務成功 | 是 | 已定案 #2 完整 |
| AGENTS／data-spec；舊「無 store git」修正 | 是 | 出貨任務；現 `AGENTS.md` 仍列「沒有 store git」為預期落差 |
| `bun test` 全綠；fixture 無真人隱私 | 是 | 已定案 #9 |
| `version.md`＝0.3.2（出貨） | 是 | — |

## 與現碼抽樣

| 觀察 | 與 0.3.2 關係 |
|------|----------------|
| 無 `server/store-git.ts`（或等價） | 本版待實作；**非 HIGH** |
| `AGENTS.md` 仍寫 Lite **沒有** store git | 與 0.3.2 定案衝突為**出貨前須改**（INDEX #8）；非提案自相矛盾 |
| `docs/data-spec.md` 無 Store git 小節 | 同上 |
| `docs/api.md` 未述 local commit 副作用 | 見 M4 |
| `server/pi.ts` distill → clarify-generate 兩 session、job 級編排 | 與 INDEX #7、HOW「completed 後一次 commit」**相容** |
| `server/index.ts` 釐清 submit／DELETE／aside、events、attachments、distill 202 | 掛鉤點與 HOW 表一致 |
| `reset-store.ts` 清空 vault、`KEEP_ROOT` 含 `.gitignore`、不含 `.git` | 適合在 script 尾端呼叫 commit；reset 後 repo 可保留歷史 |
| `demo-engram-lite-data/.gitignore` 僅 `jobs/*.json` | 實作時應對齊已定案 `jobs/` 目錄忽略（M3） |
| 無 server `ingest` job 寫 vault（ingest 為 skill／歷史） | 強化 M1：主寫入路徑含 HTTP events 與 pi distill |

**硬契約抽樣：** 未引入 dream staging／approve／setup wizard；git 在 program 機械層、非 skill 語意判斷；distill 兩 session 契約未被提案動到。**通過。**

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（須寫進 INDEX／HOW／HANDOFF 後標關閉） |
|----|----|------|--------------------------------------------------|
| M1 | M | 仍開 | — |
| M2 | M | 仍開 | — |
| M3 | M | 仍開 | — |
| M4 | M | 仍開 | — |
| L1 | L | 仍開 | — |
| L2 | L | 仍開 | — |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-21 | 門檻通過；0 HIGH；4 MEDIUM、2 LOW 待規劃收斂或實作時帶入 |
