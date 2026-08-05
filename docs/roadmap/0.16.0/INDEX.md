# 0.16.0 — Store git 事務 ＋ 入夢改為 draft 檔案作業

← [changelog](../../../changelog.md) · 上游：[0.15.0](../0.15.0/INDEX.md) · current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（2026-07-29）  
> 來源：舊 backlog「store git／簡化 draft」構想已併入本版定案（已 supersede「原地改 live／取消 draft」）  
> 本版是 **大改**：記憶庫以 **local git** 做 approve 事務與歷史；入夢改為 **一套 prompt → AI 直接改 draft 檔**；廢 typed JSON patch 驅動的 extract→materialize；報告改為固定結構 narrative；day summary 與 node `what.md` 廢 `## Current`／`## History`。

## 產品句

> 入夢時 AI 在 draft 裡改檔並寫出可讀報告；人審 approve 後一次部署進 `memories/` 並留下 git commit——失敗可只還原本次動到的檔，不再依賴複雜 typed patch／半套 apply；舊 0.15 store 可用 migration prompt 升級。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [AGENTS.md](../../../AGENTS.md) | 操作邊界；出貨時須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/store-git-and-layout.md](./docs/store-git-and-layout.md) | 目錄樹、`.gitignore`、git 進出規則、回滾 |
| 2b | [docs/week-id-mmdd.md](./docs/week-id-mmdd.md) | **補丁**：week id＝`YYYY-Www-MMDD`（週一）＋browse `start`／`end` |
| 2c | [docs/store-version.md](./docs/store-version.md) | **補丁**：`engram.workspace.yaml` 的 `store_version` |
| 3 | [docs/dream-file-pipeline.md](./docs/dream-file-pipeline.md) | 入夢／draft／report／deploy／delete／append |
| 4 | [docs/migrate-0.15-to-0.16.md](./docs/migrate-0.15-to-0.16.md) | 結構差契約；執行入口見 `.claude/skills/engram-migration/` |
| 5 | [docs/reasoning.md](./docs/reasoning.md) | 為何留 draft、為何不整庫 reset、否決項 |
| 6 | [0.14 store-layout](../0.14.0/docs/store-layout.md) | 現行磁碟三分（本版根分組大致不變） |
| 7 | [0.5 chain-dual-track](../0.5.0/docs/chain-dual-track.md) | ledger／summary 產品語意（本版保留雙軌，改寫入原語） |

**讀完 1–5 即可開工**；無需依賴本對話以外的聊天紀錄。  
**不可開工條件：** 無（待拍板已清空）。仍為 `planned` 僅表示尚未開始實作。

---

## 與 0.15 對照

| 題 | 0.15 | 0.16 |
|----|------|------|
| 入夢產出 | Agent stdout＝typed `Patch[]` → server `materializeDraft` | **一套 prompt**：AI **直接**在 `dreams/draft/{run_id}/` 改檔＋寫 report |
| Patch 類型 | `semantic`／`chain`／`future`／`propose_node`／… | **廢**作為驅動；改 **file_update**＋**file_append**（ledger）＋**deletes 清單** |
| Approve | `commitDraft` 逐檔 copy＋`.engram-bak-*` | **deploy**（rsync／copy＋先套 deletes）→ **`git commit`** |
| 失敗復原 | 行程內 bak 盡力回滾；跨行程不保證 | **只還原本次 touched paths**（禁止整庫 `reset --hard`） |
| Store git | 無 | **`ENGRAM_STORE_DIR` 必為 git repo**；無 git → **拒絕啟動** |
| Report | Server 由 patches **機械組裝** | **固定結構 narrative**（AI 寫）＋ appendix 路徑清單（每檔一兩句選填） |
| Day summary／`what.md` | `## Current`＋`## History` | **整檔＝最新敘事**；不在檔內留版本 |
| Day ledger | `# 日期`＋patch metadata＋正文 | **去掉 `# 日期`**；**保留** patch metadata；仍 append-only |
| `dreams/`／`tmp/` | 普通目錄 | **不進 git**（可重跑／執行態） |
| 人審 | approve／discard／retry | **保留**；pending 期間仍可 `POST /activities` |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版性質 | **一次做完**的大改（多 Track／phase）；**禁止**只上 git 或只砍 patch 的半套 `shipped` |
| 2 | 人審閘門 | **保留** draft → `pending_review` → approve／discard／retry；**不是**入夢直寫 live |
| 3 | 丟棄的管線 | **廢** typed JSON patch 作為 materialize 驅動；廢 server 依 `append`／`revise`／… 模擬編輯器的舊 extract→materialize 主路徑 |
| 4 | 入夢做法 | **一套 dream prompt**：AI 用 **script／工具** copy 檔進 draft 後編輯（禁止把整檔當 chat 重貼浪費 token）；寫協定 report；可含 rollup 所需之高階 summary 更新（同一 draft／同一次人審） |
| 5 | Deploy | Approve＝對 live **套用 deletes** → **draft→live 檔案部署**（copy／rsync）→ stage 相關 path → **`git commit`**（message 含 `dream_run_id`） |
| 6 | Discard／Retry | Discard＝丟該 run 的 draft／report 態（live 未被本輪改則通常無需 git 回滾）；Retry＝discard 後同凍結 scope＋reason 再入夢（產品語意同 0.12） |
| 7 | Git 進出 | **進：** `memories/**`、`engram.workspace.yaml`。**不進：** `dreams/`、`tmp/`（及若存在的 ops `log/`）。每個 `ENGRAM_STORE_DIR` 一個獨立 local repo；**不是**遠端同步方案 |
| 8 | Git 誰 init | **Server** `ensureEngramHome`（或等價啟動路徑）**幂等**保證：無 `.git` 則 `git init`；無 commit 則初始 commit（空或納入既有 `memories/`＋workspace）。Wizard **可**順便呼叫同一邏輯，**不得**當唯一入口。Reset 後同樣 ensure |
| 9 | 無 git | 本機無可用 `git` 或 ensure 失敗 → **拒絕啟動**（明確錯誤）；無降級 |
| 10 | 失敗回滾 | Deploy／commit 失敗時 **只還原本次 touched paths**（例如 `git checkout HEAD -- <paths>`）；**禁止**對整個 store `git reset --hard`（以免誤傷 pending 期間新寫的 L0／short-term） |
| 11 | Pending×activities | **維持 0.15**：`pending_review` 時可 `POST /activities`；僅 dream lock（入夢／deploy）時 `409 dream_locked` |
| 12 | File 原語 | **file_update**（create／覆寫 draft 內檔）；**file_append**（僅白名單：day **ledger** `memories/chain/days/**/*.md` 且排除 `*.summary.md`——程式級 append-only＋patch metadata）；**deletes 清單**（AI 列出；deploy 時在白名單下安全刪除） |
| 13 | Day 雙軌 | **保留**：ledger＝append-only；summary＝LLM 重寫整檔最新敘事。補記過去日仍可同時更新該日 ledger＋summary（語意同 0.5，實作改原語） |
| 14 | 廢 Current／History | **`*.summary.md`（day）與 `nodes/*/understand/what.md`** 皆改為整檔最新正文；**不**在檔內留 History。Week／month／year 本已無 History，維持整檔 snapshot |
| 15 | Ledger 格式 | **去掉**檔內 `# YYYY-MM-DD` 標題；**保留** `<!-- patch:… -->` 與 `### patch:… · events:[…]`（或等價短 metadata）＋正文 |
| 16 | Report | **固定 markdown 結構**（見 dream-file-pipeline）：AI 寫 **narrative 為主**；**Appendix**＝每條 touched path（create／update／delete／append＋可選行數）必列；每檔 **一兩句 summary 選填**（無聊／metadata 可略；寧缺勿濫）。**完整 unified diff 不嵌入 report**（可另存／API 按需） |
| 17 | Appendix 真相 | 路徑清單須與即將 deploy 的 draft **一致**；server 應機械校對（AI 多報的 path 丟棄或失敗；少報的 path 仍列出、blurb 可空） |
| 18 | HTTP 表面 | 端點名可維持 `/dreams/run|pending|approve|discard|retry|cancel`；response 中依賴 `draft_summary`／patch 計數等欄位允許改為「檔案／diff 摘要」語意——**出貨時同步 api-docs**；既有客戶端若依賴舊 patch 形狀視為本版 hard-cut |
| 19 | 依賴 | 執行期必備：**Bun**、**Agent CLI**、**Git**。README 前置需求表 **本版出貨時**再改（現在 0.15 文件先不動） |
| 20 | Migration | 通用 skill **`.claude/skills/engram-migration/`**：`SKILL.md` 負責選 hop／備份／共用規則；版本步驟在 **`migrate-{FROM}-to-{TO}.md`**（本版必有 `migrate-0.15-to-0.16.md`）。把 0.15 store 升級為 0.16（summary／what 整形、ledger 去日期標題、git init＋初始 commit、gitignore 等）。**不做**重放歷史 patches |
| 21 | 舊 patches.jsonl | **不再**作為入夢驅動；磁碟可停止寫入或僅考古；migrate **不要求**改寫歷史 jsonl |
| 22 | Week id | **`YYYY-Www-MMDD`**（`MMDD`＝該週 **週一**）；browse 回 `start`／`end`（完整日）。見 [docs/week-id-mmdd.md](./docs/week-id-mmdd.md) |
| 23 | Store version | **`engram.workspace.yaml` `store_version`**（結構世代 semver）；缺鍵不拒啟；migrate／新建才寫入；見 [docs/store-version.md](./docs/store-version.md) |

---

## 非目標

- 把記憶推上 GitHub／遠端當同步（local git only）
- 取消人審、入夢直寫 live
- Mindzone、future-sight 注入 Seek、DLQ UI、node merge（仍 backlog）
- 廢 day ledger 或改成可任意 rewrite（ledger 維持程式級 append-only）
- 用整庫 `git reset --hard` 當 discard／失敗策略
- `dreams/` 或 `tmp/` 納入 store git
- 半套出貨（例如只加 git 仍跑舊 patch 管線並標 shipped）
- 本版實作期間提前改 README 宣稱「現在就要 git」（出貨同步即可）

---

## 實作軌道（須全過；順序建議如下）

### Track 0 — 契約錨點

- **做：** 實作中若微調目錄／report 標題級／gitignore，先改本版 `docs/*` 再改碼。
- **不做：** 邊做邊發明未寫入的第三套管線。
- **驗收：** 新 agent 只讀 1–5 能說出：進 git 的路徑、入夢產物、approve 步驟、migrate 要動哪些檔。

### Track 1 — Store git 基建

- **做：** ensure 幂等 `git init`／初始 commit／寫入 `.gitignore`；啟動偵測無 git → 拒絕；reset 重建 repo；status 可暴露「store 已是 git」類資訊（若有現成欄位則用，勿為虛榮加複雜 API）。
- **不做：** 遠端、改 memories 路徑佈局（根三分維持 0.14）。
- **驗收：** 空 store 與「已有 memories 無 .git」升級啟動後皆有可用 repo；無 git binary 時啟動失敗訊息明確。
- **進度：** 已實作（`server/src/store/git.ts`；`ensureEngramHome` 呼叫；`GET /status.store_git`）；手動案例 A–D 通過。

### Track 2 — 檔案格式（live 讀寫語意）

- **做：** day summary／`what.md` 讀寫改為整檔正文（廢 Current／History 解析依賴）；ledger 寫入不再加 `# 日期`；Seek／browse／rollup 讀取對齊。
- **不做：** 改 chain 目錄分組；廢 ledger 軌。
- **驗收：** 新寫入的 summary／what 無 Current／History 節；search／ask 仍能讀到正文；`test:phases` 或等價回歸對齊新格式。
- **進度：** 已實作（`nodes`／`draft` 寫入整檔；ledger 無日期標題；讀取仍兼容未 migrate 的 Current／History）。

### Track 3 — 入夢 file pipeline＋report

- **做：** 新 dream prompt／runner：draft 工作樹、file_update／file_append／deletes、協定 report、rollup 併入同 draft；廢舊 typed patch materialize 主路徑；pending payload／UI 改看 report＋路徑摘要。
- **不做：** 恢復多 type JSON patch schema 作為主契約。
- **驗收：** 一次入夢可產生 draft＋report；pending 可審；discard／retry 行為符合已定案；Consolidate UI 可完成審核循環。
- **進度：** 已實作（`AgentRunner.dream`、`file-pipeline`、`dream-files.md`、mock 寫 draft、report finalize、pending 去 patches；approve 仍 bak＋copy，git 事務見 Track 4）。

### Track 4 — Approve deploy＋git 事務

- **做：** deletes→deploy→commit；失敗 touched-path 回滾；成功清 short-term scope S；lock 語意覆蓋入夢與 deploy。
- **不做：** 整庫 hard reset；把 `dreams/` stage 進 commit。
- **驗收：** approve 後 live 與 draft 一致且多一筆含 `dream_run_id` 的 commit；人為中斷／故意失敗後 live 與 L0 不互相誤傷；discard 後 live L2 不變。
- **進度：** 已實作（deploy 用 `restoreTouchedPaths`；approve 前 autosave dirty；成功後 `stageAndCommitPaths` message 含 `dream_run_id`；廢 bak）。

### Track 5 — Migration skill

- **做：** 維護 [`.claude/skills/engram-migration/`](../../../.claude/skills/engram-migration/SKILL.md)（路由器）＋ [`migrate-0.15-to-0.16.md`](../../../.claude/skills/engram-migration/migrate-0.15-to-0.16.md)；與 [docs/migrate-0.15-to-0.16.md](./docs/migrate-0.15-to-0.16.md) 結構差保持一致；用一份 0.15 形狀 fixture／真實庫演練。
- **不做：** 重放舊 dream；強制改寫歷史 `patches.jsonl`；把 hop 步驟只留在聊天或只留 roadmap 而無 skill 檔。
- **驗收：** 依 skill hop 檔升級後的 store 能被 0.16 server 啟動並完成一輪 activities→dream→approve；hop 檔自檢清單全勾。
- **進度：** 已補機械腳本 `scripts/migrate-0.15-to-0.16.ts`；0.15 fixture 演練通過（整形＋git＋smoke dream／approve）。

### Track 6 — 出貨

- **做：** `version.md`／`changelog.md`；api-docs／domain-language／CLAUDE／workbench skill／README 依賴表；本 INDEX → `shipped`；backlog store-git 標已併入；勾驗收總表。
- **驗收：** 總表全勾；**無**「僅部分 Track」的 shipped。
- **進度：** 已出貨（`version.md`＝0.16.0；changelog／CLAUDE／domain-language／workbench／README／api-docs／backlog 已同步）。

---

## 驗收總表

- [x] Store 啟動：有 git；無 git → 拒絕；`.gitignore` 排除 `dreams/`、`tmp/`
- [x] `memories/**` 與 `engram.workspace.yaml` 可被 approve commit 追蹤；`dreams/`／`tmp/` 不進
- [x] 入夢：draft＋固定結構 report；無 typed patch materialize 主路徑
- [x] Approve：deletes＋deploy＋git commit；失敗只還原 touched paths
- [x] Discard／retry／pending 可寫 activities：行為符合已定案
- [x] Day ledger append-only＋metadata；summary／what 無 Current／History
- [x] Rollup 經同一 draft／人審模型可更新 week／month／year
- [x] `.claude/skills/engram-migration/`（含 `migrate-0.15-to-0.16.md`）可將 0.15 store 升到可跑 0.16
- [x] `test:phases`（或本版替換之契約測試）全過
- [x] 文件與 version／changelog／README（含 git 依賴）已同步；INDEX＝`shipped`

---

## 錨點檔案（改前必讀）

| 路徑 | 角色 |
|------|------|
| `server/src/store/home.ts` | ensure 目錄；本版加 git ensure |
| `server/src/store/dreams/draft.ts` | 現行 materialize／commitDraft（將被新 pipeline 取代或大幅刪） |
| `server/src/dream/run.ts` | 入夢編排／approve／discard |
| `server/src/dream/rollup.ts` | PreferDraft；改 file draft |
| `server/src/dream/report-finalize.ts` | 協定 report 骨架／校對（0.16+） |
| `server/src/dream/schema.ts` | 舊 Patch union（主契約廢除） |
| `server/prompts/extract.md` | 舊 extract；改寫或替換為 dream file prompt |
| `server/src/cli/reset.ts`／`self-test.ts` | reset／契約回歸 |
| `web/src/scenes/ConsolidateScene.tsx` | 人審 UI |
| `docs/api-docs/api.md`、`docs/domain-language.md` | 出貨同步 |
| `.claude/skills/engram-workbench/SKILL.md` | 操作語意（API；與 migration 相反） |
| `.claude/skills/engram-migration/SKILL.md` | Store 版本遷移路由器 |
| `.claude/skills/engram-migration/migrate-0.15-to-0.16.md` | 0.15→0.16 hop 步驟 |

---

## 開工前仍須拍板

（無。細節以 `docs/*` 為準；實作微調須先改 docs。）
