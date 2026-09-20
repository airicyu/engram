# Implementation review — 0.3.0 搜尋、釐清、附圖、節點圖、工作台殼

- 日期：2026-09-20（Asia/Hong_Kong，約 02:09 HKT）
- 輪次：**初審**
- 角色：實作審查（只認檔案；不改產品碼、不 commit、不 bump `version.md`、不貼真人記憶正文）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`design-review.md`](./design-review.md)、[`../HANDOFF.md`](../HANDOFF.md)；根契約 [`../../../api.md`](../../../api.md)、[`../../../data-spec.md`](../../../data-spec.md)、[`../../../../AGENTS.md`](../../../../AGENTS.md)
- 抽樣錨點：`server/index.ts`、`server/store.ts`、`server/paths.ts`、`web/app.js`、`web/index.html`、`web/style.css`、`.agents/skills/engram-lite-distill/SKILL.md`、`.agents/skills/engram-lite-ask/SKILL.md`；相關 `server/*-*.test.ts`
- **環境註記：`NEEDS_WSL_SYNC`** — 本輪無法以 `wsl -e bash -lc`／machineId `3929bdcd-0321-4b22-ad86-a9fa7253f3c3` 讀使用者 WSL；審查與本檔寫在 box 路徑 `/home/airic/airwave/engram-lite`。Parent 請同步回 WSL 工作樹後再當正式閘門檔。

---

## 總評

| 閘門 | 結果 |
|------|------|
| 未關閉 HIGH | **無** |
| `bun test` | **全綠**（39 pass／0 fail／12 files；Bun 1.4.2；`PATH` 含 `$HOME/.bun/bin` 與 `/usr/local/bin/bun`） |
| `version.md` 仍 0.2.0 | **刻意**（未 shipped）≠ HIGH（依任務說明） |
| 未 commit | **正常**（工作樹大量 Track A–F 變更未提交） |

**可否出貨：建議可出貨（就「無未關 HIGH＋測試全綠」閘門）。**  
初審後規劃已補 **IR-M1**（`clarify.test.ts` 吸收客觀判準）。**未關 MEDIUM：無。** 仍有 **2 項 LOW**（不擋閘門）。

設計閘門（[`design-review.md`](./design-review.md)）複審已通過；本輪確認產品碼已落地 Tracks A–F（根 `docs/api.md`／`data-spec.md`／`AGENTS.md`／`README.md` crontab 句已對齊 INDEX）。

---

## `bun test` 紀錄

```
bun test v1.4.2 (744846f84)
…（12 files）
 39 pass
 0 fail
 203 expect() calls
Ran 39 tests across 12 files. [66.00ms]
```

涵蓋：`search`／`search-http`、`clarify`／`clarify-http`／`clarify-skill`、`attachments`／`attachments-http`／`attachments-skill`、`graph`／`graph-http`、`shell-ui`、`store`。  
測試一律用 `mkdtemp`／demo 路徑；未指向真人 `ENGRAM_LITE_STORE_DIR` 寫入。

---

## 驗收對照（INDEX）

| # | INDEX 驗收句 | 結果 | 證據 |
|---|--------------|------|------|
| 1 | `GET /search?q=` 命中 fixture；空 q→400；無命中→200 `{ hits: [] }` | **通過** | `server/search.test.ts`（日檔＋pending、略 archived／clarify、cap 50）；`server/search-http.test.ts`（live Bun.serve：空 q 400、無命中 envelope、命中 path `chain/days/…`）；`server/index.ts` L146–149；`store.searchMemories` |
| 2 | 尋問頁可搜、可 ask、可看近 ask job 不重跑 | **通過**（靜態） | `web/app.js` `renderSeek`：`/search`、`POST /ask`、`GET /jobs` 濾 `kind==="ask"` 終態 `.slice(0,20)`，點選 `GET /jobs/{id}` 展示 `output.text`；`shell-ui.test.ts` 斷言 `renderSeek`；**無**瀏覽器 e2e（見 IR-L1） |
| 3 | Distill→asking→submit→pending→再 distill→history＋客觀吸收 | **部分／未測完整** | 機械：`clarify.test.ts`／`clarify-http.test.ts` submit→pending、dismiss→history、aside；skill：`clarify-skill.test.ts`＋`engram-lite-distill/SKILL.md` 含 asking／`absorbed_at`／先 pending 後 pool。**缺**：無自動化測「模擬 distill 寫 `absorbed_at` 移 history」或「fixture 關鍵字入 day／node」（INDEX 明寫擇一寫進測試）→ **IR-M1** |
| 4 | aside 不進 `pool/pending.jsonl` | **通過** | `clarify.test.ts`（`createClarifyAside`／submit 路徑斷言 pending.jsonl 不含 aside 正文）；aside `kind: aside` 落 `clarify/pending/` |
| 5 | 上傳 png 201；events 對稱／單邊／缺檔／alias→400；無圖＝0.2 | **通過** | `attachments.test.ts`、`attachments-http.test.ts`（1×1 png、正式 `_attachments/uploads/{day}/`、對稱 200、單邊／缺檔／alias 400）；`store.validateEventAttachments`／`appendPendingWithAttachments`；`index.ts` `POST /attachments`／`/events` |
| 6 | Day 稿可含同一 `![[…]]`；mock 不必真看圖 | **通過**（契約） | `attachments-skill.test.ts`＋distill SKILL「Day 相關才插入同一精確 embed／不要像素／禁止發明 path」；server 不組圖敘事 |
| 7 | `GET /nodes/graph` 雙端成邊；死連忽略 | **通過** | `graph.test.ts`（空庫 envelope、雙向／單向、死連、無向去重、title fallback）；`graph-http.test.ts`；`store.buildNodeGraph`；`index.ts` `/nodes/graph` 在 `/nodes/{id}` 之前 |
| 8 | 左欄四景；圖≥2 點有邊；預覽走 file GET | **通過**（靜態） | `web/index.html` 四鏈；`app.js` `mountForceGraph` SVG 力導向；`renderEmbedsHtml`→`/attachments/file?path=`；事件選圖／貼圖上傳；`shell-ui.test.ts`。瀏覽器實際畫邊 **未測**（IR-L1） |
| 9 | 無 React／Vite；無 `dreams/` | **通過** | `package.json` 無 vite／react；`shell-ui.test.ts`；倉庫無 `dreams/`；distill skill 明示不要 dream／approve |
| 10 | `bun test` 全綠；不碰真人 store | **通過** | 見上節；tmp／demo only |

---

## Findings

關閉＝已修或本輪確認不成立；仍開＝應追蹤。穩定 ID 不重編號。

### HIGH

（無）

未發現與 INDEX 硬契約互斥的實作（無 server 出題／寫作引擎、無 dream／approve、無 React／Vite、無內建 cron、附圖無 tmp）。`version.md`＝0.2.0 與未 commit **不計** HIGH。

### MEDIUM

#### IR-M1 — 驗收「吸收」客觀判準未寫進自動化測試 — **已關閉**

- **問題：** INDEX 驗收要求 distill 吸收後滿足擇一客觀判準「**寫進測試即可**」：(1) fixture 關鍵字 ∈ day／node；或 (2) `history/`＋frontmatter `absorbed_at`。現況僅 `clarify-skill.test.ts` 斷言 SKILL.md **字串**含 `absorbed_at`／asking／history；機械測覆蓋 submit／dismiss，**沒有** fixture 模擬 distill 吸收落檔。
- **為何 MEDIUM：** 主路徑 HTTP／store／skill 契約已齊，非功能缺失級 HIGH；但驗收句明示要可自動化的吸收斷言，缺口在測試層。
- **建議：** 加一支不跑真 Pi 的 fixture 測：手動／helper 把 pending 釐清檔加上 `absorbed_at` 移入 `history/`（或寫假 day 含約定關鍵字），斷言 INDEX 擇一條件；可選再斷言 ask skill 仍不讀 clarify。

### LOW

| ID | 狀態 | 說明 |
|----|------|------|
| IR-L1 | **仍開** | 尋問／四景／節點圖／embed 預覽僅靜態＋單元；無 headless 瀏覽器 e2e。圖「≥2 點有邊」依 `mountForceGraph` 源碼與 `GET /nodes/graph` 測推斷。 |
| IR-L2 | **仍開** | 多數 `*-http.test.ts` 為 **route mirror**（自建 `Bun.serve` 複製規則），未掛載真實 `server/index.ts` entry。store 層與 mirror 目前對齊；長期有漂移風險。可選改為匯出 `fetch` handler 或啟動真實 server。 |

（`version.md` 未 bump、未 commit：依任務 **不開 finding**。）

---

## 軌道落地抽樣

| Track | 狀態 | 簡證 |
|-------|------|------|
| A 搜尋＋Ask 列表 | 已落地 | `GET /search`；UI `#/seek` 搜＋ask＋近 20 ask jobs |
| B 釐清 | 已落地 | `clarify/{asking,pending,history}`；GET／submit／DELETE／aside；distill／ask skill 段；郵箱 UI |
| C 附圖 | 已落地 | `POST /attachments`、file GET、events 對稱、預覽、distill 教學 |
| D 節點圖 | 已落地 | `GET /nodes/graph`＋SVG 力導向 |
| E 殼 | 已落地 | 左欄四景、紙色 CSS、無 React／Vite |
| F 契約 | 已落地（文件） | 根 `api.md`／`data-spec.md`／`AGENTS.md`／README crontab；**未** bump version／changelog 出貨宣告 |

---

## 硬契約抽樣（非目標／禁區）

| 檢查 | 結果 |
|------|------|
| Skills 寫 live；server 機械讀寫＋202 派 Pi | 符合（`index.ts` enqueue distill／ask；clarify／attachments／events 同步） |
| Ask 不讀 clarify | `engram-lite-ask/SKILL.md`＋`clarify-skill.test.ts` |
| 搜尋不掃 clarify／archived／attachments bytes | `searchMemories`＋`search.test.ts` |
| 無 tmp 上傳 | `saveAttachmentUpload`→正式 `uploads/{day}/` |
| 無 dreams／approve／React／內建 cron | 抽樣符合；README／AGENTS crontab 一句 |

隱私：本報告未引用真人記憶正文；測試 token 皆為虛構（如 `HTTP_SEARCH_TOKEN_OK`、`FIXTURE_ASIDE_TOKEN_AS3`）。

---

## 修復追蹤表

| ID | 級 | 狀態 | 備註 |
|----|----|------|------|
| IR-M1 | MEDIUM | **已關閉** | `server/clarify.test.ts`：pending→history＋`absorbed_at`；day 含 fixture 關鍵字 |
| IR-L1 | LOW | **仍開** | 可選瀏覽器 e2e |
| IR-L2 | LOW | **仍開** | 可選真實 server handler 測 |

---

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-20（HKT） | 無未關 HIGH；`bun test` 39／0 全綠；Tracks A–F 檔案層已落地。**建議可出貨**（閘門）。未關 IR-M1（吸收驗收測）、IR-L1／L2。`NEEDS_WSL_SYNC`。未改碼、未 commit。 |


---

## 規劃收斂（IR-M1，2026-09-20 HKT）

規劃 session 補測關閉 IR-M1：

- 新增 `server/clarify.test.ts` 用例 `absorb criterion: pending→history with absorbed_at + day keyword`
- 模擬 distill 檔案操作：pending → history 並寫 `absorbed_at`；day 正文含 `FIXTURE_ABSORB_TOKEN_42`
- 對應 INDEX 驗收客觀判準 (1)(2)
- `bun test server/clarify.test.ts`：6 pass

複審未再開；本檔標 IR-M1 **已關閉**。
