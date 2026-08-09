# 0.28.0 實作審查報告

← [INDEX](../INDEX.md) · [HANDOFF](../HANDOFF.md)

**初審：** 2026-08-09（相對 `73b28b5`／0.27 working tree）  
**複審：** 2026-08-09（修復後；`bun run test:phases` 通過）  
**對照基準：** 本版 INDEX 已定案／驗收  

**複審結論：** 先前 HIGH（H1／H2／H4）與納入本版的 H3（TTL）均已對齊；MEDIUM 主項已補。剩餘為低優先文件／字串。**可以 commit／当真出貨。**

---

## 1. 總評

| 面向 | 初審 | 複審 |
|------|------|------|
| Node 主檔 `{id}.md`、seed、API `understanding` | 對齊 | 對齊 |
| Prompt／mock P1 wikilink、Structure notes | 對齊 | 對齊；phases 含缺標題＋approve |
| Finalize／commit 擋 legacy path | **H1 缺口** | **已修** |
| api.md boot ≥0.28 | **H2 缺口** | **已修** |
| Report TTL 預設 7 | 曾標 scope creep | **INDEX #25 納入**；維持 7 |
| Migrate 清 `dream.lock` | **H4 缺口** | **已修** |
| `test:phases` | 未核實 | **通過**（約 12s） |

---

## 2. 變更範圍（複審時仍未 commit）

主線同初審；修復額外動到例如：

- `server/src/store/dreams/file-pipeline.ts`／`.test.ts`、`draft.ts`
- `server/src/agent/shared/write-policy.ts`（`isForbiddenLegacyNodeRel`）
- `docs/api-docs/api.md`、setup-wizard、`README.md`
- migrate script／skill md（`dream.lock`）
- `self-test.ts` Phase 4a／T1b

---

## 3. Findings — 複審狀態

### HIGH

| ID | 題 | 狀態 | 證據 |
|----|-----|------|------|
| **H1** | Draft 掃盤可 deploy 舊 path | **已修** | `finalizeDraftFromDisk`：forbidden rel → `rm` draft 檔並省略 manifest；`assertSafeStoreRel`／`upsertManifestEntry`／`commitDraft` 再拒。`file-pipeline.test.ts`「omits legacy」通過 |
| **H2** | api.md boot 仍 0.19 | **已修** | `api.md`：≥ **0.28**、hop `migrate-0.19-to-0.28`、offline／need not be running／pending discarded |
| **H3** | TTL 30→7 | **非缺陷／已定案** | INDEX #25；changelog Changed；`DEFAULT_…=7` 正確保留 |
| **H4** | Migrate 未清 lock | **已修** | script `rm dreams/dream.lock`；skill md 步驟寫明；self-test assert「migrate cleared dream.lock」 |

### MEDIUM

| ID | 題 | 狀態 | 說明 |
|----|-----|------|------|
| **M1** | Track C phases 缺標題 | **已修** | Phase 4a：amend 後 Structure notes 含 missing heading；approve → 200 |
| **M2** | setup／README vault | **大致已修** | 根 `README.md`、setup-wizard 中英 lede 有 Obsidian＝`memories/`。`server/README`／`web/README` 仍無一句（可選補） |
| **M3** | shipped／未 commit | **程序** | backlog 已指 shipped；working tree 仍待使用者 commit |
| **M4** | CLI 禁寫落差 | **緩解** | 掃盤＋commit 硬擋後，approve 路徑已閉環；CLI 仍可靠 prompt 少寫垃圾檔 |

### LOW（複審後已修）

| ID | 題 | 狀態 |
|----|-----|------|
| L1 | `whatPath` deprecated alias | **已刪**（僅用 `understandingPath`） |
| L2 | structure-notes 測改全域 `config.storeDir` | **已改** child process + `ENGRAM_STORE_DIR` |
| L3 | self-test 成功字串「0.19＋0.20」 | **已改** `through 0.28` |
| L4 | `deletes.txt` 拒 legacy | **已改** `assertSafeStoreRel(..., { allowLegacyNodePaths: true })` |
| M2 餘 | server／web README 無 vault | **已補** |

---

## 4. 驗收對照（複審）

| INDEX 驗收項 | 結果 |
|--------------|------|
| 主檔 `nodes/{id}/{id}.md`；無 stub／understand 必填 | 通過 |
| API `understanding` | 通過 |
| 不能寫舊 `what.md`（白名單＋掃盤／commit） | **通過** |
| Prompt／mock 四段＋P1 | 通過 |
| Structure notes；approve 不硬拒 | **通過**（含 phases） |
| Migrate 離線；清 pending＋lock；stamp 0.28；無 `_attachments` | **通過** |
| 文件 vault＝`memories/` | **通過**（主入口） |
| Boot 拒啟文案 | **通過**（程式＋api.md） |
| TTL 預設 7 | **通過**（#25） |
| `test:phases` | **通過** |
| version／changelog／AGENTS；INDEX shipped | 檔案齊；**待 commit** |

---

## 5. 測試（複審執行）

```text
cd server && bun test …write-policy / file-pipeline / structure-notes
→ 13 pass

cd server && bun run test:phases
→ ✅ All 0.19＋0.20 self-checks passed
  （含 Phase 4a Structure notes、T1b migrate 0.19→0.28／lock）
```

---

## 6. 修復追蹤

- [x] H1 finalize／commit 擋 legacy node path  
- [x] H2 api.md boot／migrate 文案 → 0.28  
- [x] H3 report TTL **30→7 納入本版**（不還原；INDEX #25）  
- [x] H4 migrate 清 `dream.lock`  
- [x] M1 phases 缺標題 fixture  
- [x] M2 主入口 setup／根 README 註 vault（server／web README 可選）  
- [x] `bun run test:phases`  
- [x] L1–L4／M2 餘（whatPath、structure-notes 隔離、self-test 字串、deletes 允 legacy、server／web README）  
- [x] **使用者 commit** 0.28（`860b4a3`）

---

## 7. 初審摘要（史料）

初審時曾列四項 HIGH：掃盤可落地舊 path、`api.md` 仍寫 0.19、TTL 誤判為 scope creep、migrate 未清 lock。TTL 經產品確認併入本版；其餘三項已在複審關閉。詳細初審敘事見本檔 git 歷史／對話紀錄即可，以 §3 複審表為準。
