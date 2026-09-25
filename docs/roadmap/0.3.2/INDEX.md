# 0.3.2 — Store git：每次成功改 vault 就 local commit

← [changelog](../../../changelog.md) · 上游：[0.3.1](../0.3.1/INDEX.md)（`shipped`）· current: [version.md](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-21）  
> 範圍：記憶庫目錄（`ENGRAM_LITE_STORE_DIR`）維護 **local-only git**；凡 **成功**寫入 vault 的操作結束後自動 `git commit`。  
> **不**引入 dream staging／approve；**不**推 GitHub；**不**把其他產品倉庫當依賴。  
> **開工前仍須拍板：無。** 執行走 `.agents/skills/roadmap-version`。

## 產品句

記憶庫像一本可回溯的筆記本：每一次成功寫入（記事、沉澱、釐清作答、附件等）都留下一筆 **local git commit**，方便對照歷史與誤改復原——不必經過審核關卡。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | paste-ready |
| 1 | **本檔 INDEX** | 定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | 掛鉤點、gitignore、API／文件同步 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何比 Engram「approve 後 commit」更簡 |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 觸發時機 | **操作成功結束後** commit 一次。至少涵蓋：`POST /events`（含附圖事件）、附件上傳落地、`POST /distill` job **成功終態**（含同 job 內 clarify-generate）、釐清 `submit`／`DELETE`（dismiss）／`aside`、以及 reset skill **成功清空後**（reset 可一次 commit，message 標明 reset）。**讀取**（search／ask／graph／GET）不 commit。**範圍外：** 使用者僅用 pi-agent 直跑 skill（ingest／distill 等、不經 server 列舉路徑）時 **不**自動 commit；skills 不負責 git。 |
| 2 | 失敗語意 | 業務操作失敗 → **不** commit。git 本身失敗（未裝 git、lock、無權）→ **只記 server／job log**，**不**回滾已寫入的記憶檔、不把 HTTP 改成 5xx（除非該操作尚未回成功；若已回 200／202 完成，git 失敗不得改寫既有成功回應）。 |
| 3 | 倉庫根與追蹤範圍 | git 根＝**store 根**（`ENGRAM_LITE_STORE_DIR`）。追蹤：`memories/`（及 store 根上必要的 `workspace.yaml` 若存在）。**不追蹤：** `jobs/`、暫存／lock／log、OS 垃圾（`.DS_Store`）。以 store 根 `.gitignore` 寫死；若檔已存在則**合併**必要條目（必保 `jobs/` 整目錄被忽略），保留使用者自加行。 |
| 4 | init | store 若尚非 git repo：第一次需要 commit 時 **自動 `git init`**（local only；不設 remote）。 |
| 5 | commit message | 單行、可機器掃：`engram-lite: {op} {id?}`。例：`engram-lite: event evt_…`、`engram-lite: distill job_…`、`engram-lite: clarify-submit cla_…`、`engram-lite: attachment …`、`engram-lite: reset`。禁止把事件／日記**正文**寫進 message（隱私）。 |
| 6 | 實作位置 | **Program／server（或極薄 `store-git.ts` helper）** 在機械寫入成功路徑呼叫；skills **不**負責 git。符合「調度在 program」。 |
| 7 | 與 0.3.0／0.3.1 | 可並行；不依賴搜尋／圖 UI／文體文案。若同檔衝突以合併為準，不得拿掉既有「distill 兩 session／不寫 asking」契約。 |
| 8 | 文件／契約 | 更新 `AGENTS.md`（Lite **有** store git：**預設恆常啟用**、無 env 關閉；每次 server 列舉成功寫入後 local commit；仍無 dream approve）、`docs/data-spec.md`（store git 行為小節）、**必**更新 `docs/api.md` 一句「副作用：成功寫入後可能 local commit」。自 0.2／0.3.0 **非目標**清單移除「store git」或改為「本版已做」。 |
| 9 | 測試 | `bun test`：用 temp store；(a) 無 repo → 首次寫入後出現 `.git`＋至少 1 commit；(b) 連續兩次成功寫入 → commit 數增加；(c) `.gitignore` 使 `jobs/` 不進 commit；(d) 模擬 git 失敗 → 業務仍成功、有 log（可用 stub／注入）。**禁止**用真人記憶庫當 fixture。 |
| 10 | 出貨 | 驗收勾完 → `version.md`＝`0.3.2`、`changelog.md` 一筆；狀態 `shipped`。**不要 git commit 本程式倉，除非使用者要求。**（記憶庫 store 的 commit 是產品行為，與程式倉分離。） |
| 11 | 隱私／自立 | store git **預設無 remote**；文件禁止教使用者把私人 store push 到公開 GitHub。本功能不依賴 Engram／其他產品倉庫。 |

## 開工前仍須拍板

無。

## 非目標

- Dream staging、approve／discard、draft deploy  
- 自動 `git push`／設定 GitHub remote  
- `store_version` boot gate、Engram migrate hop  
- 把 commit 做成 skill 判斷、或 server 文風／內容規則引擎  
- UI 瀏覽 git history（可列 backlog；本版不需）  
- 與 `engram-data` 共用庫  

## 驗收

- [x] 空 store：首次成功 `POST /events`（或等價機械寫入）後，store 根有 `.git`，`git log -1` message 符合 `engram-lite: …`
- [x] 再一次成功寫入 → 新 commit（hash／log 筆數增加）
- [x] `jobs/` 下檔案不出現在 `git ls-files`
- [x] distill job 成功終態後有對應 commit（可與事件分屬不同 commit）
- [x] clarify submit／aside／dismiss 成功後有 commit
- [x] `docs/api.md` 已述成功寫入後可能 local commit
- [x] git 失敗不回滾記憶；測試可證明業務成功路徑仍成立
- [x] `AGENTS.md`／`data-spec` 已描述行為；舊「無 store git」非目標已修正
- [x] `bun test` 全綠；fixture 無真人隱私
- [x] `version.md`＝`0.3.2`（出貨時）

## 實作軌道

| Track | 做 | 不要 |
|-------|----|------|
| A Helper | `store-git.ts`：ensureRepo、commitOp、gitignore | push、remote |
| B Hooks | events／attachments／clarify／distill done／reset 成功路徑呼叫 | skill 內 git |
| C Docs＋test | AGENTS、data-spec、契約測、version／changelog | 真人 store |

## 錨點

`server/store.ts`、`server/index.ts`、`server/jobs.ts`／`server/pi.ts`（distill 成功）、clarify／attachments 寫入函式、`AGENTS.md`、`docs/data-spec.md`、`.agents/skills/roadmap-version`

← [0.3.1](../0.3.1/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
