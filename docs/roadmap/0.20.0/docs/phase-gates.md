# 0.20.0 — Phase 測試閘門

← [INDEX](../INDEX.md)

> **強制：** 完成某一 Phase 的程式變更後，必須跑完該 Phase 本章節列出的命令與場景，**全部通過**才可開始下一 Phase。  
> 實作 agent 應在 PR／進度註記寫下：跑了什麼、結果、日期。  
> 環境：於 `server/`（或 repo 根既有 script）使用 **Bun**；記憶庫用隔離目錄（`test:phases` 既有慣例），**禁止**拿使用者生產 `ENGRAM_STORE_DIR` 跑破壞性自測。

---

## 共用前置

```bash
# 於 engram repo
cd server && bun run test:phases
```

出貨前 Phase 6 必須全綠。中間 Phase 可只跑「該 Phase 新增／標記的案例」＋與該 Phase 直接相關的回歸；若腳本尚未分檔，允許暫時跑全套 `test:phases`，但 **新增案例必須已寫入且通過**。

若本版改為多檔 `bun test`：閘門命令以實際 package script 為準，並 **回寫本檔**（先改 docs 再改碼的精神）。

---

## Phase 0 — 契約錨點

**命令：** 無碼則無測試命令。

**人工自檢（實作開始前）：**

| # | 問題 | 期望答案（摘要） |
|---|------|------------------|
| G0.1 | approve 前 agent 可寫哪些根？ | 僅 draft／report／契約 temp；不可寫 live `memories/**` |
| G0.2 | `releaseLock` 能否無參刪檔？ | 否；必須核對 owner |
| G0.3 | 要不要 migrate？ | 不要；boot ≥0.19 |
| G0.4 | Phase 可否先做 Web 再做 sandbox？ | 否；依 INDEX 順序 |

通過標準：自檢表可勾；docs 與 INDEX 無矛盾。

---

## Phase 1 — Agent 寫入隔離

**必增自動化（名稱可調整，語意不可少）：**

| # | 場景 | 期望 |
|---|------|------|
| G1.1 | Mock／測試 runner 在 dream 期間寫入 `memories/nodes/{id}/understand/what.md`（live） | **live 檔內容不變**（或根本無法寫入）；draft／report 仍可按契約更新 |
| G1.2 | 正常 mock dream → pending → approve | 既有主路徑仍過：draft 變更在 approve 後才進 live（對齊 0.16） |
| G1.3 | Ask 路徑試圖寫 live node／chain 檔 | live 不變；ask 交付檔（temp／契約路徑）行為符合既有 ask 契約 |
| G1.4 | Rollup 路徑只寫入允許的 draft summary 路徑 | live 在 approve 前不被 rollup 直接改（若現況 rollup 只碰 draft，回歸證明即可） |

**命令：**

```bash
cd server && bun run test:phases
# Phase 1 sandbox unit gates:
bun test src/agent/shared/write-policy.test.ts
```

**通過標準：** G1.1–G1.4 全過；既有 dream approve 快樂路徑不回退。

**程式審查清單（輔助，不能取代自動化）：**

- [ ] `providers/claude.ts`／`providers/cursor.ts` 不再以「整個 store 可寫」為預設
- [ ] Ask／Rollup 同等政策
- [ ] Prompt 文字與強制力一致（可寫根有寫明）

---

## Phase 2 — Owner-aware lock

**必增自動化：**

| # | 場景 | 期望 |
|---|------|------|
| G2.1 | 持有 lock A；以 **錯誤 owner** 呼叫 release | lock 檔仍在；meta.owner 仍為 A |
| G2.2 | 持有 lock A；以 **正確 owner** release | lock 消失 |
| G2.3 | 模擬：A 取得 lock → 人為／測試將 lock 換成 B（或 stale break 後 B acquire）→ A 的 finally／release(A) | **B 的 lock 仍在** |
| G2.4 | `POST /dreams/run` 在已 lock 且未 stale 時 | `409`（或既有 dream_locked 語意）；不破壞持有者 |
| G2.5 | cancel 僅釋放「該 job／該次 acquire」的 owner | 不誤殺他人 lock |

**命令：**

```bash
cd server && bun run test:phases
# Phase 2 lock unit gates:
bun test src/store/dreams/lock.test.ts
```

**通過標準：** G2.1–G2.5 全過；手動看 `dream.lock` JSON 含可核對 owner／token 欄。

---

## Phase 3 — Capture 原子性

**必增自動化：**

| # | 場景 | 期望 |
|---|------|------|
| G3.1 | 連續 N 次（建議 ≥20）串行 `POST /activities` | event id **嚴格遞增、無重複** |
| G3.2 | 並行 M 次（建議 ≥10）同時 capture（同 process 多 Promise 或多請求） | **無重複 id**；每次成功回應的事件在 L0 與 short-term pool **皆可查到對應內容** |
| G3.3 | `node_refs` 傳字串（非陣列） | **400**；不寫入錯誤 node note |
| G3.4 | `node_refs` 傳合法 `string[]` | 200；行為與 0.19 等價 |

**命令：**

```bash
cd server && bun run test:phases
# Phase 3 cases live in self-test Phase 9 (G3.1–G3.4)
```

**通過標準：** G3.1–G3.4 全過。若並行測試在單核 CI 偶發 flake，須修實作或加嚴同步，**禁止**用 `skip` 混過閘門。

---

## Phase 4 — Server 結構

**自動化＋靜態檢查：**

| # | 場景 | 期望 |
|---|------|------|
| G4.1 | 全庫搜尋 `materializeDraft`／`appendMaterializeDraft` | **無**仍掛在主路徑的實作；或僅剩測試註明「已刪」的註解都應清掉——以「呼叫端＝0、符號刪除」為準 |
| G4.2 | `ENGRAM_AGENT=mock`（及 claude／cursor 若可在無 binary 下解析） | dream／ask／rollup **同一 factory** 解析；錯誤 mode → 明確失敗 |
| G4.3 | `bun run test:phases` | Phase 1–3 案例＋既有 0.19 分數／dream 案例仍過 |
| G4.4 | （建議）`bunx tsc --noEmit` 於 `server/` | 無因拆檔產生的型別錯誤 |

**通過標準：** G4.1–G4.3 必過；G4.4 若環境有 tsc／類型檢查 script 則必過。

**人工：** `dream/run.ts` 行數顯著下降或職責已遷出；公開路由表未改 path。

---

## Phase 5 — Web

**自動化（能寫則寫；最少手動腳本）：**

| # | 場景 | 期望 |
|---|------|------|
| G5.1 | Seek：開始 ask → 立即切到其他 scene → 等超過原輪詢間隔 | **無** React「unmounted update」警告；網路輪詢停止（DevTools／log 可證） |
| G5.2 | 有 running ask job 時進入／重整 Seek | 可看到進行中態，且能 **cancel** 或自動 resume 至完成 |
| G5.3 | Memory：快速連續切換 chain level／node | 畫面不顯示明顯過期的錯檔內容（stale guard） |
| G5.4 | `cd web && bun run build`（或專案既有 build） | 成功 |

若尚無 component test runner：G5.1–G5.3 允許 **書面手動驗收紀錄**（步驟＋結果），但不得省略；G5.4 必須命令通過。

**靜態：**

- [ ] 無 `setSelectedChainId((prev) => { ... fetch ...})` 這類 updater 內副作用
- [ ] ask 輪詢有 abort／cancelled flag／cleanup

---

## Phase 6 — 出貨總閘

**命令（全部必跑）：**

```bash
cd server && bun run test:phases
cd web && bun run build
```

**對照 INDEX 驗收總表** 逐條勾選。

**文件：**

- [ ] `version.md` = `0.20.0`
- [ ] `changelog.md` 有 0.20.0 節（寫清正確性／重構，勿誇大產品功能）
- [ ] `docs/api-docs/api.md`：若有新錯誤碼／lock／activities 驗證行為已寫
- [ ] `CLAUDE.md`：若操作邊界有「agent 不可寫 live」等句已同步
- [ ] 本版 INDEX 狀態 → `shipped`；各 Phase「進度」可標完成

**通過標準：** 總表全勾；上述命令全綠；無「已知失敗但先 shipped」。

> **註：** Phase 0–6 首輪出貨後已通過本節。開啟 **Phase 7** 後，最終再次 `shipped` 前須重跑本節命令，並另過下方 Phase 7 閘門。

---

## Phase 7 — Generic agent flow＋目錄

**必達自動化／靜態：**

| # | 場景 | 期望 |
|---|------|------|
| G7.1 | 搜尋 Claude／Cursor 組 `cmd = [` 長列表 | **僅**（或幾乎僅）出現在 `agent/providers/`（或等價單一處）；`ask-*`／`claude-code`／`rollup` 業務檔不再各複製完整 argv |
| G7.2 | Ask 快樂路徑（mock 或 phases） | 仍寫 result 檔→parse；行為與 Phase 5／既有 ask 等價 |
| G7.3 | Dream → pending → approve（`test:phases` 主路徑） | 不回退；report／draft 契約仍成立 |
| G7.4 | Rollup phase（self-test 既有 rollup 段） | plan／write 仍經檔案交付 |
| G7.5 | `bun test` write-policy（G1.1–G1.4 語意） | **不回退** sandbox |
| G7.6 | 目錄 | 存在 `agent/flow/`、`agent/providers/`、`agent/shared/`、以及 `dream/`｜`ask/`｜`rollup/` 業務子目錄；`agent/` **根目錄**無大量平鋪 runner 檔（僅 `factory.ts` 或文件允許的極薄 re-export） |
| G7.7 | `cd server && bun run test:phases` | 全綠 |
| G7.8 | `cd web && bun run build` | 成功（確認未誤傷） |

**命令：**

```bash
cd server && bun test src/agent/shared/write-policy.test.ts
# 若測試隨目錄遷移，以實際新路徑為準並回寫本行
cd server && bun run test:phases
cd web && bun run build
```

**通過標準：** G7.1–G7.8 全過；INDEX Phase 7 驗收條可勾；changelog 0.20.0 已補本 Phase。

> **註：** Phase 7 完成後曾標 `shipped`。開啟 **Phase 8** 後，最終再次 `shipped` 前須重跑 `test:phases`／web build，並過下方 Phase 8 閘門。

---

## Phase 8 — Dream 目錄

**必達自動化／靜態：**

| # | 場景 | 期望 |
|---|------|------|
| G8.1 | `server/src/dream/` 目錄樹 | 存在 `execute/`、`review/`、`report/`、`score/`、`rollup/`、`shared/`、`legacy/`（名稱允許文件內已定別名，語意對齊） |
| G8.2 | `dream/` 根目錄 | 僅薄 `run.ts`（及必要時 README）；**無** `execute.ts`／`approve.ts` 等平鋪業務檔殘留 |
| G8.3 | `from "../dream/run"`（或等價 barrel） | `api/dream`、`api/status`、`seek/ask-run`、cli 等仍可編譯／執行 |
| G8.4 | Dream 主路徑 | `test:phases` 含 run→pending→approve／retry／discard／score 相關段不回退 |
| G8.5 | Rollup | self-test rollup 段＋`agent/rollup` import 正確 |
| G8.6 | `cd server && bun run test:phases` | 全綠 |
| G8.7 | `cd web && bun run build` | 成功 |

**命令：**

```bash
cd server && bun run test:phases
cd web && bun run build
# 可選：find src/dream -maxdepth 1 -name '*.ts' 應大致只有 run.ts
```

**通過標準：** G8.1–G8.7 全過；INDEX Phase 8 驗收可勾；changelog 已補；INDEX → `shipped`。

---

## Phase 9 — API 目錄

| # | 場景 | 期望 |
|---|------|------|
| G9.1 | `api/` 樹 | 有 `dream/`、`seek/`、`memory/`；根目錄無 `dream.ts`／`dream-events.ts`／`future-sight.ts` |
| G9.2 | `memory/` | 含 future-sight、short-term-memory、chain、nodes |
| G9.3 | `test:phases` | 全綠 |

**通過標準：** G9.1–G9.3（2026-08-02 已過）。
