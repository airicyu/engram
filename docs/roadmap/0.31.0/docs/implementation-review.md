# 0.31.0 實作審查報告

← [INDEX](../INDEX.md) · [HANDOFF](../HANDOFF.md) · [hash-routing](./hash-routing-and-wikilinks.md) · [chain-node-wikilinks](./chain-node-wikilinks.md)

**初審：** 2026-08-12  
**修復輪：** 2026-08-12（實作 agent：M1／M2）  
**複審：** 2026-08-12（實作自核：`test:phases` 複跑綠）  
**對照基準：** 本版 INDEX 已定案／驗收（只認檔案與 working tree／diff；不認 chat history）  
**相對基準：** `f23b8e0`（0.30.0）＋未 commit working tree

**複審結論：** **無未關 HIGH**；**M1／M2 已修**；**M3** 標非阻擋。`bun run test:phases` 複跑 **全綠**（橫幅 `through 0.31`）。INDEX 可標 **`shipped`**。**待使用者同意後再 commit。**

---

## 1. 總評

| 面向 | 初審 |
|------|------|
| Track A — Hash 路由（parse／serialize、懶寫、`#/memory`→chain、push／replace） | **對齊** |
| Track B — `preprocessNodeWikilinks`＋`MdBlock`（P1、短連 known-only、不傷 `![[`） | **對齊**（單元測綠） |
| Track C — prompts／day mock P1／summary soft lint／phases day assert | **大致對齊**；rollup mock＋Phase 7 鎖定偏弱（**M1**） |
| Track D — version／changelog／AGENTS／domain-language／非回填句；無 migrate | **對齊**；self-test 橫幅字串滯後（**M2**） |
| 非目標（path router、backfill、boot gate bump、`@` mentions） | **未做**（正確） |
| `test:phases` | **綠** |

### 變更範圍（`git status`／`diff --stat`）

**Modified（19）：** `AGENTS.md`、`changelog.md`、`version.md`、`docs/domain-language.md`、`docs/roadmap/0.30.0/INDEX.md`、`docs/roadmap/backlog/INDEX.md`、prompts（dream-files／rollup-write-*／amend）、`mock.ts`、`self-test.ts`、`structure-notes.ts`＋test、`App.tsx`、`MemoryScene.tsx`、`SeekScene.tsx`、`ui.tsx`

**Untracked：** `docs/roadmap/0.31.0/**`、`web/src/lib/hashRoute.ts`＋test、`preprocessNodeWikilinks.ts`＋test、`docs/roadmap/backlog/activity-node-mentions.md`

約 **+382／−47**（已追蹤檔）；無新增 migrate hop。

---

## 2. Findings

### HIGH

（無）

### MEDIUM

| ID | 題 | 狀態 | 證據／說明 |
|----|-----|------|------------|
| **M1** | Rollup mock／Phase 7 對 P1 鎖定不足 | **已修** | `fuseMockNarrative` 若輸出無 `[[nodes/`，自 lower／prior 抽 P1 或 fallback `acme`；Phase 7 assert month summary 含 `[[nodes/`。`test:phases` 複跑綠。 |
| **M2** | `test:phases` 成功橫幅仍 `through 0.30` | **已修** | 改為 `through 0.31`。 |
| **M3** | 部分 `MdBlock` 未傳 `knownNodeIds` | **可留／非阻擋** | Memory／Seek **search** nodes／chain 已傳。Consolidate report、Seek Ask 答案／L1、Activities L1 未傳 → **短連**不轉；**P1 path 形態仍轉**。與 hash-routing「Consolidate 可空 Set」一致。 |

### LOW

| ID | 題 | 狀態 | 說明 |
|----|-----|------|------|
| **L1** | `web/README.md` 仍寫「no react-router in 0.10」 | **可留** | 未提 0.31 hash 深鏈；不擋出貨 |
| **L2** | push／replace／懶寫無 E2E／元件測 | **可留** | `hashRoute.test.ts` 覆蓋 parse／serialize；App／Memory 行為靠碼審 |
| **L3** | Summary soft lint：檔內任一 `[[` 即跳過 peer 檢查 | **可留** | 與「有 `[[` 則略過」啟發式一致；含僅 `![[` embed 時可能漏警告 |
| **L4** | INDEX 驗收已勾、狀態仍 `in progress` | **非缺陷** | 待本審查關閉後再標 `shipped`（HANDOFF Done） |

---

## 3. 驗收對照（初審）

| INDEX 驗收項 | 結果 |
|--------------|------|
| `#/consolidate` 等五場景可深鏈；重新整理後場景正確 | **碼有**（`parseHash`／`App` mount 讀 hash；單元測五場景＋空→activities） |
| `#/memory/nodes/{id}`／`#/memory/chain/{level}/{id}` 可深鏈；列表點選改 hash | **碼有**（列表 `replace`；mode／level `push`；未知 id 維持選中） |
| `#/memory` 無子路徑 → **chain mode**；空 hash 懶寫不自動 `#/activities` | **碼有**（`parseHash("#/memory")`→chain；mount 不呼叫 `writeHash`） |
| 場景 tab → push；Memory 同 mode 換選中 → replace | **碼有**（`writeHash`＋`onScene`／列表） |
| Node／chain 正文 P1 渲成可點 `#/memory/nodes/…` | **碼有**（preprocess＋`MdBlock`；Memory／Seek 傳 known） |
| 短連僅 known；`![[…]]` 不拆壞 | **通過**（單元測） |
| dream-files／rollup／amend prompts 要求存在中 node 寫 P1；mock＋`test:phases` 綠 | **大致通過**（day mock＋phases assert；rollup 見 **M1**） |
| 文件明寫不做歷史 chain backfill | **通過**（changelog／domain-language／AGENTS／backlog 列） |
| **無** store migrate；boot gate 仍 ≥0.28 | **通過**（`REQUIRED_STORE_STRUCTURE` 仍 0.28；無 `migrate-0.30`；AGENTS 註 0.30→0.31 無 hop） |

---

## 4. 測試（初審執行）

### `bun run test:phases`

```text
export PATH="$HOME/.bun/bin:$PATH"
cd /home/airic/airwave/engram/server && bun run test:phases

→ Phase 0 … Phase 0.30: Clarify …
→ ✅ All self-checks passed (through 0.30)
  約 16s，exit 0
```

（含 Phase 2 day summary／ledger `[[nodes/` assert。）

### Web 單元測

```text
cd web && bun test src/lib/hashRoute.test.ts src/lib/preprocessNodeWikilinks.test.ts
→ 13 pass, 0 fail
```

### Structure notes

```text
cd server && bun test src/dream/report/structure-notes.test.ts
→ 4 pass, 0 fail
  （含「summary mentions peer without [[ → warning」）
```

---

## 5. 修復追蹤

- [x] **M1** — rollup mock 保證 P1＋Phase 7 month assert `[[nodes/`
- [x] **M2** — self-test 成功字串 `through 0.31`
- [x] **M3** — 標非阻擋（可留）
- [x] L1–L3 — 可留
- [x] `test:phases` 全綠（初審＋複審）
- [x] INDEX 狀態 → `shipped`
- [ ] 使用者同意後再 **commit** 0.31

---

## 6. 歷審摘要

| 輪 | 要點 |
|----|------|
| **初審**（2026-08-12） | 三 Track 主線到位；無 HIGH；phases 綠；M1 rollup／phases 鎖定、M2 橫幅字串；M3 短連表面可選 |
| **修復**（2026-08-12） | M1／M2 已修；M3 非阻擋 |
| **複審**（2026-08-12） | `test:phases` 複跑綠（through 0.31）；可 shipped |
---

## 7. 建議後續

1. 實作 agent 優先修 **M1／M2**；M3／L 可標非阻擋。  
2. 複審重跑 `test:phases`＋上述單元測；無迴歸後標 INDEX `shipped`。  
3. 使用者要求時再 git commit（含本審查檔與未追蹤 `web/src/lib/*`、`docs/roadmap/0.31.0/`）。

**做什麼以 INDEX 為準**；本檔只追實作對定案的落差。
