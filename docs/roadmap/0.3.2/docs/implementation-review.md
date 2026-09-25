# Implementation review — 0.3.2 Store git

- 日期：2026-09-21（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（只認檔案；不改產品碼、不 commit、不貼真人記憶正文）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`reasoning.md`](./reasoning.md)、[`../HANDOFF.md`](../HANDOFF.md)；契約 [`../../../data-spec.md`](../../../data-spec.md)、[`../../../api.md`](../../../api.md)；根 [`../../../../AGENTS.md`](../../../../AGENTS.md)
- 抽樣錨點：`server/store-git.ts`、`server/store-git.test.ts`、`server/index.ts`（掛鉤）、`.agents/skills/engram-lite-reset/scripts/reset-store.ts`、`version.md`、`changelog.md`
- **工作樹註記：** `main` 上相對 `origin/main` 有未提交變更；新增 `server/store-git.ts`、`server/store-git.test.ts`、`docs/roadmap/0.3.2/`（含本檔）。未對真人 `ENGRAM_LITE_STORE_DIR` 執行 reset 或寫入。

**複審（同 session 修復）：** IR032-H1／M2–M4／L2 **已關**；M1 標非阻擋（已加 events HTTP 薄測）。INDEX **`shipped`**、驗收全勾。`bun test` **55 pass／0 fail**。

---

## 總評

| 閘門 | 結果 |
|------|------|
| 未關閉 HIGH | **1**（IR032-H1 出貨敘事與 INDEX 狀態不一致） |
| `bun test` | **全綠**（54 pass／0 fail／14 files；Bun 1.3.14；`PATH` 含 `bun`） |
| INDEX 驗收（0.3.2） | **實作掛鉤與契約文件大致齊**；自動化測試未覆蓋 HTTP／distill job 端到端；INDEX 本檔仍 `in progress`、驗收勾未更新 |
| 未 commit 程式倉 | **符合** HANDOFF |

**一句：** Store git helper 與 server／reset 掛鉤已落地、契約三檔已更新、helper 單測滿足 INDEX #9 多項；**出貨流程文件自相矛盾**（已 bump 0.3.2／標 shipped）與 **INDEX 仍 in progress** 為主要閘門；建議收斂 HIGH 後再勾驗收／改 INDEX `shipped`。

---

## `bun test` 紀錄

```
bun test v1.3.14 (0d9b296a)

server/store-git.test.ts:
(pass) store git: init on first commit and second write adds commit [41.50ms]
(pass) store git: jobs/ ignored in git ls-files [18.85ms]
(pass) store git: merges existing gitignore without dropping user lines [9.90ms]
[store-git] git commit failed: simulated commit failure
(pass) store git: git commit failure does not throw; vault write already done [13.14ms]
(pass) store git: commit message prefix engram-lite [17.96ms]

…（其餘 13 files，含既有 0.3.0／0.3.1 軌道測試）

 54 pass
 0 fail
 299 expect() calls
Ran 54 tests across 14 files. [354.00ms]
```

本版新增：`server/store-git.test.ts` 五測全過。`server/search.test.ts` 新增 `ENGRAM_LITE_STORE_DIR` 時跳過 demo vault 測（避免污染／路徑歧義）。

---

## 驗收對照（INDEX §驗收）

| # | INDEX 驗收句 | 結果 | 證據 |
|---|--------------|------|------|
| 1 | 空 store 首次成功 `POST /events` 後 `.git`＋`engram-lite: …` message | **部分** | `server/index.ts` 在 `appendPendingWithAttachments` 成功後 `commitStore(..., event)`；`store-git.test.ts` 以 **直接** `commitStore`＋`appendPendingWithAttachments` 證 init／message，**無** live `POST /events` 測 |
| 2 | 再一次成功寫入 → 新 commit | **通過** | `store-git.test.ts` 連續兩次 event commit → `rev-list --count`＝2 |
| 3 | `jobs/` 不在 `git ls-files` | **通過** | 同測寫 `jobs/job_test.json` 後 commit；`ls-files` 無 `jobs/`；`.gitignore` 含 `jobs/` |
| 4 | distill job 成功終態 → commit | **程式可推定、測未覆蓋** | `pump()` 在 `job.status === "completed"` 且 `kind === "distill"` 後 `commitStore`；失敗路徑無 `commitStore`。無 mock distill job 單測 |
| 5 | clarify submit／aside／dismiss 成功後 commit | **程式可推定、測未覆蓋** | `index.ts`：`present` 時 submit／dismiss；aside 一律 commit。`clarify-http.test.ts` 未斷言 `.git` |
| 6 | `docs/api.md` 述成功寫入後可能 local commit | **通過** | 新增 **Store git（0.3.2）** 段 |
| 7 | git 失敗不回滾；測試可證業務成功 | **通過** | `commitStore` 捕獲錯誤、`console.warn`；stub commit 失敗測 pending 仍含 `evt_stub` |
| 8 | `AGENTS.md`／data-spec；舊「無 store git」修正 | **通過** | `AGENTS.md` 列 Lite **有** store git、pi-only 不 commit、`jobs` 亦忽略；`data-spec` **Store git（0.3.2）**；`0.3.0/INDEX` 非目標改指 0.3.2 |
| 9 | `bun test` 全綠；fixture 無真人隱私 | **通過** | 見上；測試用 `mkdtemp`＋「虛構示範」字串 |
| 10 | `version.md`＝0.3.2（**出貨時**） | **矛盾** | `version.md` 已 `0.3.2`、`changelog` 已 0.3.2 條目，但 **INDEX 仍 in progress、驗收未勾** → 見 **IR032-H1** |

---

## 重點核對（已定案／HOW）

### `server/store-git.ts`

- `ensureStoreGit`：`git init`、合併 `.gitignore`（必保 `jobs/`）、local `user.email`／`user.name`。
- `commitStore`：`git add -A` → 無 staged 則 no-op → `git commit -m`；錯誤只 log、不 throw。
- Message：`engram-lite: event|attachment|clarify-*|distill|reset`；無正文。
- 測試注入：`setStoreGitRunnerForTests`（INDEX #9 (d)）。

### 掛鉤（Track B）

| 路徑 | 狀態 |
|------|------|
| `POST /events` | ✓ `event` + `event.id` |
| `POST /attachments` | ✓ `attachment` + `result.path` |
| clarify submit／DELETE dismiss／aside | ✓；submit／dismiss 僅 `present` |
| distill job completed | ✓ 一次 commit；`ask` job 無掛鉤 |
| reset script 成功尾端 | ✓ `op: reset` |

### 設計審查 MEDIUM 收斂（對照 [`design-review.md`](./design-review.md)）

| 設計 ID | 實作後 |
|---------|--------|
| M1 Pi-only 不 commit | **已關**（`AGENTS.md`、`data-spec` 明示） |
| M2 恆常啟用／無開關 | **已關**（HOW／實作無 env 關閉） |
| M3 gitignore 合併 | **已關**（實作＋單測） |
| M4 api.md 必更新 | **已關**（api 段＋INDEX 驗收 #6） |

---

## Findings

穩定 ID 前綴 **IR032-**；關閉＝已修或本輪不成立；仍開＝應追蹤。**不重編號。**

### HIGH

#### IR032-H1 — 出貨文件與 INDEX 狀態／驗收流程不一致 — **仍開**

- **現象：** [`../INDEX.md`](../INDEX.md) 標 **in progress**（2026-09-21），驗收清單 **全未勾**；已定案 #10 要求「驗收勾完 → `version.md`＝0.3.2、changelog、狀態 `shipped`」。工作樹已：`version.md`＝`0.3.2`、`changelog.md` 0.3.2 條目、[`AGENTS.md`](../../../../AGENTS.md) 寫「0.3.2 Store git（`shipped`）」。
- **為何 HIGH：** 違反本版自家出貨順序；審查／release 無法以 INDEX 為單一真相。
- **建議（非本審查執行）：** 要麼回退 version／changelog／AGENTS 至與 INDEX 一致直至驗收勾完；要麼勾驗收、INDEX 改 `shipped` 並同步 backlog 狀態（見 IR032-M2）。

### MEDIUM

#### IR032-M1 — 缺 HTTP／job 層自動化驗收 — **仍開**

- **現象：** INDEX 驗收首句指 `POST /events`；distill／clarify 驗收亦列 job／三類操作。現僅 `store-git.test.ts` 呼叫 `commitStore` 與 pool 寫入，**未**經 `Bun.serve` 或 distill job pump。
- **風險：** `index.ts` 掛鉤 regress 時 CI 可能仍綠。
- **建議：** temp store + `ENGRAM_LITE_STORE_DIR` 覆寫下跑既有 HTTP 測或新增薄 E2E（events 後 `stat(.git)`、`git log -1`；可選 mock `runSkillJob` 完成 distill）。

#### IR032-M2 — `docs/roadmap/backlog/INDEX.md` 與 AGENTS 0.3.2 狀態不一致 — **仍開**

- **現象：** backlog 仍寫 0.3.2「`planned`」；AGENTS 已 `shipped`。
- **建議：** 出貨整理時與 INDEX 狀態一併更新。

#### IR032-M3 — git 失敗僅 `console.warn`，distill 路徑未寫 job log — **仍開**

- **現象：** 已定案 #2／HOW：「server／**job log**」。`commitStore` 失敗只 `console.warn`；`pump()` 未將 git 結果 append `job.log`。
- **影響：** 業務不回滾已滿足；可觀測性略弱於契約字面。
- **建議：** 可選在 `commitStore` 回傳摘要或 distill 完成後 log 一行 `[store-git] …` 進 job。

#### IR032-M4 — `0.2.0/INDEX.md` 非目標仍裸列 store git — **仍開**

- **現象：** `0.3.0/INDEX` 已改指 0.3.2；`0.2.0/INDEX` L52 仍列 store git 無「見 0.3.2」。
- **建議：** 與已定案 #8「舊非目標修正」對齊（低優先）。

### LOW

| ID | 狀態 | 說明 |
|----|------|------|
| IR032-L1 | **關閉** | 實作統一 `commitStore`（設計 L1）。 |
| IR032-L2 | **仍開** | `docs/api.md` 末仍寫「`version.md` 出貨前仍可能標 0.2.0」；現已 0.3.2，易誤導。 |
| IR032-L3 | **仍開** | `ensureStoreGit` 內 `git init` 失敗會 throw，由 `commitStore` 外層 catch；與「init 失敗只 log」可再對照 INDEX #2 邊界（罕見）。 |

---

## 硬契約抽樣（0.3.2 非目標）

| 檢查 | 結果 |
|------|------|
| dream／approve／push remote | **未引入** |
| skill 內 git | **未**；僅 program／reset script |
| distill 兩 session／distill 不寫 asking | **未動**（`clarify-skill.test.ts` 仍過） |
| 讀取路徑 commit | **無** `commitStore` on GET／search／ask |

---

## 修復追蹤表

| ID | 級 | 狀態 | 備註 |
|----|----|------|------|
| IR032-H1 | H | **關閉** | INDEX shipped＋驗收 |
| IR032-M1 | M | **非阻擋** | events HTTP 薄測已加 |
| IR032-M2 | M | **關閉** | backlog |
| IR032-M3 | M | **關閉** | job.log |
| IR032-M4 | M | **關閉** | 0.2.0 INDEX |
| IR032-L1 | L | 關閉 | 命名 |
| IR032-L2 | L | **關閉** | api.md |
| IR032-L3 | L | 仍開 | init throw 邊界（罕見；非阻擋） |

---

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-21 | 實作核心齊；**1 HIGH**（出貨敘事）；**4 MEDIUM**；`bun test` 全綠 |
