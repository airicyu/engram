# 0.11.0 — Week／Month／Year Memory Chain

← [changelog](../../changelog.md) · 上游：[0.10.0](../0.10.0/INDEX.md) · current: [version](../../version.md) · 詞彙：[domain-language.md](../../domain-language.md)

> **狀態：** **shipped（0.11.0）**  
> **讀完本頁 + docs/ 三份子文件即可開工**，無需依賴聊天紀錄。  
> 推理與反例（為何這樣定）：[docs/reasoning.md](./docs/reasoning.md)

## 產品句

> 在日鏈之上補齊 **週／月／年** 記憶鏈：以較低層 summary 做區間融合；**init 可追蹤、之後仍可因補記而 revise**；Workbench 可瀏覽更高粒度時間軸；Search／Ask 可讀到這些摘要。同版先完成 day 目錄按月分組（行為不變）。

---

## 文件地圖（閱讀順序）

| # | 文件 | 讀者 | 內容 |
|---|------|------|------|
| 0 | [AGENTS.md](../../AGENTS.md) | 所有人 | 語言、API 邊界、禁止手改 store 當操作 |
| 1 | **本檔 INDEX** | 所有人 | 範圍、已定案、軌道、驗收、禁止事項 |
| 2 | [docs/reasoning.md](./docs/reasoning.md) | 所有人 | **為何**如此定（補記反例、planner／writer、串聯、Track 0、不做 git） |
| 3 | [docs/store-layout.md](./docs/store-layout.md) | Server | id、磁碟路徑、day 遷移、initialized_*.yaml |
| 4 | [docs/rollup-pipeline.md](./docs/rollup-pipeline.md) | Server | dream 串聯、planner／writer 契約、draft／approve、backfill、測試點 |
| 5 | 既有 day 雙軌 | Server | [../0.5.0/docs/chain-dual-track.md](../0.5.0/docs/chain-dual-track.md)（day 仍雙軌；高階 **不要**抄 ledger） |
| 6 | MVP 時間邊界（歷史） | 參考 | [../mvp/docs/memory-chain.md](../mvp/docs/memory-chain.md) — **「closed＝凍結」已被本版推翻**，見 reasoning |

---

## 如何開工

1. 讀 `AGENTS.md` → 本檔 → `reasoning.md` → `store-layout.md` → `rollup-pipeline.md`
2. 對照錨點程式（下方「錨點檔案」）
3. **嚴格按 Track 0 → 1 → 2 → 3 → 4 → 5** 順序；每軌勾驗收後再進下一軌
4. 全做完：更新 `version.md`（`0.11.0`）、`changelog.md`、`domain-language.md`、`AGENTS.md`、`api-docs/*`
5. `cd server && bun run test:phases` 必須全過

**操作記憶狀態只打 HTTP API**（遷移 CLI 除外）；勿手改 yaml／md「幫忙改對」當日常操作。

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版層級 | **week + month + year 都做**（year 機制與另兩層同形，UI 可較簡但 API／store 要通） |
| 2 | 高階檔案形態 | **只做 summary snapshot**（整份 markdown；**無** `## Current`／History）；**不做** week／month／year ledger |
| 3 | 「關帳」語意 | 改為 **initialized**：記錄是否已 init；**不**阻止之後 revise。勿實作「跑過就永不更新」 |
| 4 | 補記 | 過去 day 被 revise 後，對應 week／month／year 須能再次 rollup（planner Y → writer revise） |
| 5 | Day 與高階關係 | Day 仍走既有 extract；高階 **獨立** planner＋writer，**禁止**塞進同一輪 day extract 產出 |
| 6 | Planner 產出 | 僅 **Y/N + ids + reason（+ init/revise 標註）**；**禁止**產 summary 全文 |
| 7 | Writer 產出 | 讀下層 context，產完整 Current；寫入 **draft**；approve 時 replace live |
| 8 | 串聯順序 | **Option 2**：day → week(planner→writers) → month → year；上層須 prefer 本輪 **draft** |
| 9 | 候選 id | 由本輪變更的 `day_id` **機械推導** week／month／year 集合，再交 planner 删减 |
| 10 | Month 讀 week | 用 **日期重疊** 的 ISO weeks，不是「資料夾 YYYY-MM 同名」 |
| 11 | Day 目錄 | `days/YYYY-MM/…`；與高階 **同版**，列 **Track 0** 先做 |
| 12 | Week 目錄 | `weeks/YYYY-MM/{ISO-week}.summary.md`，分組＝該週 **週一** 所在年月 |
| 13 | Month／year 目錄 | `months/YYYY/{YYYY-MM}.summary.md`；`years/{YYYY}.summary.md` |
| 14 | 人審 | **同一** `dream_run_id`／一次 pending_review／一次 approve 提交 day＋高階 |
| 15 | 時鐘 | Planner／writer 的 today／now 與 extract 相同（`ENGRAM_TZ` + 虛擬時鐘） |
| 16 | Draft | **維持** draft；**不**在本版改用 git 事務（見 backlog） |
| 17 | 空讀取 | 無內容 → `200` + `present: false`／空陣列；**不用** 404 表示空 |

---

## 範圍摘要

### Track 0 — Day 目錄分組（無行為變更）

- 將 `memory-chain/days/{id}.md` 遷到 `memory-chain/days/{YYYY-MM}/{id}.md`（summary 同理）
- 單一 path helper；遷移既有 store／`data-demo`；browse／search／dream day 路徑全改
- **驗收焦點：** API JSON 形狀與語意與 0.10 等價

細節：[store-layout.md](./docs/store-layout.md)

### Track 1 — Store＋路徑＋initialized 索引

- week／month／year summary 讀寫 helper
- `initialized_{weeks,months,years}.yaml`（或等價「以檔存在為準」——須與 store-layout 一致）
- Draft／manifest 支援高階 summary 路徑

### Track 2 — Rollup 管線（Server dream）

- 串聯 planner／writer（新 prompts + schema + mock）
- Materialize 進同一 draft；report 段落；approve／discard／cancel 語意見 rollup-pipeline
- Backfill CLI 或等價手段（`data-demo` 可長出高階 chain）

細節：[rollup-pipeline.md](./docs/rollup-pipeline.md)

### Track 3 — HTTP API

**保持相容：**

| 端點 | 行為 |
|------|------|
| `GET /memory/chain` | **仍為 day index**（新→舊）；勿破壞既有客戶端 |
| `GET /memory/chain/{day_id}` | **仍為 day detail**（`YYYY-MM-DD`） |

**新增（必須）：**

| 端點 | 行為 |
|------|------|
| `GET /memory/chain/weeks` | week index（新→舊）+ preview（80 字元，對齊 day）+ `present` |
| `GET /memory/chain/weeks/{week_id}` | week detail；非法 id → `400`；無檔 → `200` `present: false` |
| `GET /memory/chain/months` | month index |
| `GET /memory/chain/months/{month_id}` | month detail |
| `GET /memory/chain/years` | year index |
| `GET /memory/chain/years/{year_id}` | year detail |

路由註冊順序：先掛 `/memory/chain/weeks` 等靜態段，再掛 `/{day_id}`，避免把 `weeks` 當成 day_id。

**Search／Ask：**

- `GET /memory/search`：chain scope 須能命中 week／month／year summary（可仍歸在 `chain` 陣列並帶 `level` 欄位，或分 key——**擇一寫進 api-docs，預設建議每 hit 含 `level`**）
- `POST /memory/ask`：更新 `memory-ask.md` prompt，列高階路徑供 agent 讀

### Track 4 — Web Memory browse

- Memory「記憶鏈」支援切換 **Day｜Week｜Month｜Year**（或同等清晰 IA）
- 各層：拉 index → 預設最新一筆 → detail
- i18n（`en` + `zh-Hant`）
- 不把 Search／Ask 搬回 Memory

### Track 5 — Docs & release

- `api-docs`、`domain-language.md`、`AGENTS.md`、`version.md`、`changelog.md`
- 註明 MVP「closed 凍結」已被 initialized＋revise 取代

---

## 非目標（勿做）

- 用 git 管理 `ENGRAM_HOME`、刪除 draft 模型 → [backlog/store-git-transactions.md](../backlog/store-git-transactions.md)
- 高階 ledger、把下層內容 dump 進高階當「ledger」
- 「closed／initialized 後禁止 revise」
- 把 week／month／year 塞进既有 day `extract.md` 一次產完
- Planner 產 summary 全文
- Node merge、mindzone、future-sight 注入 Memory／Seek
- 記憶內容自動翻譯、無關大重構
- 排程 cron（可用手動 dream + backfill CLI；不必本版上系統排程）

---

## 錨點檔案（改前必讀）

### Server

| 路徑 | 用途 |
|------|------|
| `server/src/store/chain.ts` | day 讀取／list；**Track 0 改造中心** |
| `server/src/store/draft.ts` | day ledger／summary draft；擴高階 |
| `server/src/store/home.ts` | 目錄確保；已有 weeks／months／years 空目錄 |
| `server/src/dream/run.ts` | extract → materialize → pending；串 rollup |
| `server/src/dream/schema.ts` | `ChainPatch.level` 現僅 `day` |
| `server/src/api/memory/chain.ts` | browse handlers |
| `server/src/memory/search.ts` | chain 掃描 |
| `server/src/cli/self-test.ts` | phases；加遷移／rollup／browse 測 |
| `server/prompts/extract.md` | **不要**塞高階全文；可註明高階另管線 |
| `server/prompts/memory-ask.md` | 補高階路徑 |

### Web

| 路徑 | 用途 |
|------|------|
| `web/src/scenes/MemoryScene.tsx` | day chain browse；擴層級 |
| `web/server.ts` | `/api/memory/chain*` proxy |
| `web/src/i18n/*.json` | 文案 |

### Docs（實作後必更新）

| 路徑 |
|------|
| `api-docs/api.md`、`api-docs/README.md` |
| `domain-language.md`、`AGENTS.md` |
| `server/README.md`、`web/README.md` |
| `version.md`、`changelog.md` |

---

## 實作軌道（逐項；做完打勾）

### Track 0 — Day 目錄分組

**做什麼：**

1. 實作 `dayLedgerPath`／`daySummaryPath` → `memory-chain/days/YYYY-MM/…`
2. 更新所有讀寫：draft、search、browse list（改為掃子目錄）、self-test 路徑断言
3. 提供遷移：flat → 分組（至少覆蓋 `data-demo` + 文件說明如何對任意 `ENGRAM_HOME` 執行）
4. 更新 prompts／api-docs／domain-language 中的路徑字串

**不要做什麼：**

- 不改 day ledger／summary 語意
- 不在本軌實作 week／month／year writer

**驗收：**

- [ ] 新 capture→dream→approve 的 day 檔出現在 `days/YYYY-MM/`
- [ ] `GET /memory/chain`、`/{day_id}`、search 含 chain 與遷移前等價
- [ ] `bun run test:phases` 通過
- [ ] `data-demo` 已遷移且可被 server 讀到

---

### Track 1 — 高階 store 基礎

**做什麼：**

1. path helpers：week／month／year summary
2. `read*Summary`／`list*Ids`（新→舊）
3. draft apply／commit：高階 summary init＝建檔、revise＝**replace Current**（無 History）
4. `initialized_*.yaml` 在 **approve 成功後** 更新（discard 不寫）

**驗收：**

- [ ] 單元／self-test 可寫讀一週 summary（可手工 fixture）
- [ ] commit 後 live 路徑符合 store-layout

---

### Track 2 — Rollup 管線

**做什麼：**

1. 機械：day_ids → week／month／year 候選
2. Planner agent＋JSON schema＋prompt（每層或可參數化；**禁止**全文 summary）
3. Writer agent＋下層 context 組裝（month 重疊 weeks；prefer draft）
4. 接入 `run.ts`：day materialize 成功後串聯；失敗 → 既有 dream_incomplete 語意
5. Report：列出各層 execute／ids／operation／reason
6. Mock runners 供 test:phases
7. Backfill CLI（或等價）並用 `data-demo` 產出高階檔

**不要做什麼：**

- 不在 day `extract.md` 要求模型輸出 week／month／year
- 不實作「initialized 則 skip writer」

**驗收：**

- [ ] 補記舊日情境：month 已存在時第二次 dream 會 revise（用 mock 可測）
- [ ] discard／cancel 不留 live 高階變更
- [ ] 串聯時 month writer 能讀到本輪 week draft（測 prefer-draft）
- [ ] `test:phases` 含 mock rollup 路徑

---

### Track 3 — Browse／Search／Ask API

**做什麼：**

1. 註冊 weeks／months／years 的 index＋detail
2. Search hits 帶 level（或文件化的等價結構）
3. Ask prompt 更新
4. `api-docs` 同步；`/` endpoints 列表更新

**驗收：**

- [ ] 空 store：各 index `present: false`
- [ ] 非法 week／month／year id → `400`
- [ ] 舊 day 端點回歸綠
- [ ] proxy：`web/server.ts` 含新路徑

---

### Track 4 — Web UI

**做什麼：**

1. Memory 記憶鏈層級切換 Day／Week／Month／Year
2. 各層 index＋detail；preview 80；新→舊；預設選最新
3. i18n

**驗收：**

- [ ] 四層皆可瀏覽（有資料時）
- [ ] Seek／Capture／Consolidate 無回歸

---

### Track 5 — Docs & release

**做什麼：**

1. `version.md` → `0.11.0`
2. `changelog.md` 條目（含：initialized≠freeze、summary-only、day 分組、API）
3. `domain-language.md`／`AGENTS.md`：chain 不再「僅 day」
4. 若有 UI／契約截圖需求：更新 `web/README.md`

**驗收：**

- [ ] 文件與實作一致
- [ ] changelog 寫明非目標（無 git store、無高階 ledger）

---

## 驗證指令（實作後補齊精確參數）

```bash
cd server && bun run test:phases

# Day（相容）
curl -s 'http://localhost:8787/memory/chain' | jq .
curl -s 'http://localhost:8787/memory/chain/2026-07-14' | jq .

# 高階
curl -s 'http://localhost:8787/memory/chain/weeks' | jq .
curl -s 'http://localhost:8787/memory/chain/months' | jq .
curl -s 'http://localhost:8787/memory/chain/years' | jq .
```

Backfill／遷移 CLI 名稱於實作時寫入 `server/README.md`，並回鏈本 INDEX。

---

## 與 0.10.0 的關係

| 0.10.0 | 0.11.0 |
|--------|--------|
| 僅 day chain；`days/` flat | day 分組 + week／month／year summary |
| Memory browse 僅 day | 四層 browse |
| Dream＝day extract 管線 | day 後串聯高階 planner／writer |
| （無）initialized 高階索引 | approve 後維護 initialized_* |

---

## 相關 backlog（本版不做）

| 項目 | 說明 |
|------|------|
| [store-git-transactions.md](../backlog/store-git-transactions.md) | `ENGRAM_HOME` local git 取代／簡化 draft |
| [near-future-mindzone.md](../backlog/near-future-mindzone.md) | mindzone |
| [recall-future-sight.md](../backlog/recall-future-sight.md) | Recall 注入未來視 |

---

**狀態：** shipped — 見 `version.md`／`changelog.md`。
