# 0.27.0 — Amend-dream（pending 同稿自由句小修）

← [changelog](../../../changelog.md) · 上游：[0.26.0](../0.26.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md) · 來源：[backlog dream-draft-edit](../backlog/dream-draft-edit.md)

> **狀態：** **shipped**  
> Pending review 時除 **re-dream**（現行 `POST /dreams/retry`）外，新增 **amend-dream**：同一 `dream_run_id` 上依自由句小修 draft／report。**無** store migrate。來源構想曾列 backlog `dream-draft-edit`（出貨後自 INDEX 移除；細節可仍見該檔史料）。

## 產品句

> 審夢時若正文小錯，可選 **amend-dream** 在同一稿上改，不必整輪重抽；若方向錯了仍走 **re-dream**。兩者在 Consolidate 的 **Revise** 裡二選一觸發。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [../backlog/dream-draft-edit.md](../backlog/dream-draft-edit.md) | UX 草圖與心智模型（re-dream ≠ amend-dream） |

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | API | **`POST /dreams/amend`**；body `{ instruction, dream_run_id? }`；`instruction` trim 後非空，否則 **400** `missing_instruction` |
| 2 | 對照 retry | **不** `discardPending`、**不** `prepareDreamDraft`（wipe）、**不**換 `dream_run_id`；job_id＝現行 pending id |
| 3 | 成功 | Agent 改 draft 白名單路徑＋可更新 report Narrative；server `finalizeDraftFromDisk` → involvements 校驗 → `finalizeDreamReport`（插入／保留 `## Amend feedback`）；仍 `pending_review` |
| 4 | 失敗 | **保留** pending＋既有 draft／report；`dream_job.status=failed`；**不** `removeDraft`；**不**把 extract_state 打成會清 pending 的 incomplete（pending 仍優先 → `dream_status` 維持 `pending_review`） |
| 5 | Prompt | 新檔 `server/prompts/amend-dream.md`；**不**重用全量 `dream-files.md` |
| 6 | 白名單 | 可寫根＝該 run 的 `draft_dir`＋`reports/`（既有 write-policy）；路徑仍須 `memories/` 相對安全規則；本版**不**重跑 rollup cascade（需要 cascade 請 re-dream） |
| 7 | UX | Consolidate：報告／involvements 在上 → `hr` → **丟棄｜修正｜批准**；**修正**開 overlay（radio re-dream｜amend-dream + textarea + 取消／送出） |
| 8 | 產品動詞 | UI／文件用 **re-dream**／**amend-dream**；HTTP 仍為 `/dreams/retry` 與 `/dreams/amend` |
| 9 | Store | **不** bump `store_version`；**無** migrate |

---

## 非目標

- 無 pending 時改 live 記憶
- 用 amend 取代 approve 人審
- 強制用自由句改 involvements category（繼續走 2a）
- Amend 路徑重跑 week／month／year cascade
- 拆 pending report 為 JSON sections

---

## 實作軌道

### Track A — Server API＋pipeline＋prompt

- **做：** `handleDreamAmend`；`amendDream` pipeline；`DreamCliRunner.amend`；`amend-dream.md`；errors `MissingInstructionError`；finalize 支援 Amend feedback
- **不要：** 失敗清 draft；與 retry 共用 discard→新 id 路徑
- **驗收：** 同 id pending；缺 instruction → 400；無 pending → 409

### Track B — Web Revise UI

- **做：** Consolidate：報告＋involvements → `hr` → 丟棄／修正／批准；修正開 overlay（re-dream｜amend-dream）；proxy／`engramApi.dreams.amend`；i18n
- **不要：** 用 expand／collapse 嵌在頁面內的第二套表單
- **驗收：** re-dream 打 retry；amend-dream 打 amend；主列無「展開修正選項」

### Track C — 文件與出貨

- **做：** api-docs、AGENTS、workbench skill、version／changelog；backlog 2b 條改指本版或刪除
- **驗收：** 契約與 UI 動詞一致；`test:phases` 含 amend 段

---

## 驗收

- [x] `POST /dreams/amend` 缺／空白 `instruction` → 400 `missing_instruction`
- [x] 無 pending → 409 `no_pending`；id 不符 → 409 `dream_run_mismatch`
- [x] 成功後 `dream_run_id` 不變、仍 `pending_review`；report 含 Amend feedback／instruction
- [x] 失敗路徑：`AmendFailedError` 不 `removeDraft`（self-test 以成功路徑＋契約為主；失敗語意見 pipeline）
- [x] UI：報告／involvements → `hr` → 丟棄｜修正｜批准；修正 overlay 選 re-dream／amend-dream
- [x] **無** `store_version` bump；**無** migrate
- [x] `bun run test:phases` 通過
- [x] backlog 2b 已自 INDEX 移除；本版狀態 → `shipped`

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/api/dream/run.ts` | `handleDreamAmend` |
| `server/src/dream/execute/pipeline.ts` | `amendDream` |
| `server/prompts/amend-dream.md` | amend prompt |
| `server/src/agent/dream/runner.ts` | `amend()` |
| `web/src/scenes/ConsolidateScene.tsx` | Revise UI |
| `docs/api-docs/api.md` | 契約 |

---

## 與上一版對照

| | 0.26.0 | 0.27.0 |
|--|--------|--------|
| Pending 修正 | retry（整輪）＋2a category | **＋ amend（同稿）** |
| `dream_run_id` on 修正 | retry → 新 id | amend → **同 id** |
| Store | 無 migrate | 無 migrate |
