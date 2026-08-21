# 0.41.0 設計審查報告

← [INDEX](../INDEX.md) · [locking-and-snapshots](./locking-and-snapshots.md) · [reasoning](./reasoning.md) · [HANDOFF](../HANDOFF.md)

> **日期：** 2026-08-21（初審）  
> **對照基準：** 本版 INDEX 已定案 A–E、非目標、驗收；GUIDELINES／agent-workflow；現行 `lock`／pipeline／approve／UI  
> **範圍：** 只審文件自足與失敗模式。**本檔不是已定案。** 建議項須回規劃 agent 併入 INDEX／HOW 後才可開工。  
> **結論：** 產品句清楚。初審 HIGH／MEDIUM 已於 2026-08-21 **併入 INDEX／HOW／HANDOFF**（規劃收斂）。實作前以 INDEX 為準。

---

## 1. 總評（對 GUIDELINES）

| 面向 | 判斷 |
|------|------|
| 標題／上游／狀態／產品句 | **夠**。`planned`；產品句含「誰／得到什麼／單場邊界」。 |
| 已定案 | **主幹完整句子**（A–E），非關鍵字堆。 |
| 非目標 | **夠硬**（兩場夢、改 Ask、clarify id 塞 `scope[]`、多進程）。 |
| 驗收 | **可勾**；phases＋交錯清 pool 有寫。 |
| 錨點 | **路徑對**，對得上現行 `isLocked`／`listPendingIds`／三個 Scene。 |
| 文件地圖／Track／對照 | **有**。 |
| reasoning | **該寫且已寫**（否決表＋六條失敗模式）。 |
| 隱私 | **無** live 記憶正文。 |
| 開工前仍須拍板 | INDEX 已寫 **無** |
| Self-sufficient | 併入後 HOW 含凍結偽碼、report 禁二讀、generate 同鎖 |

厚度：鎖＋快照＋HTTP＋UI＝中改；INDEX＋docs＋reasoning＋HANDOFF 符合 GUIDELINES。缺的是 HANDOFF 品質與幾條失敗模式的鎖點。

---

## 2. 對 agent-workflow

| 檢查 | 現況 |
|------|------|
| INDEX 已定案、無待拍板混寫 | 通過（拍板表未寫「無」） |
| HANDOFF 存在 | 有 |
| Paste-ready 四要素 | **已補** HANDOFF starter |
| 雙向 backlog | 通過（`backlog/background-dream-lock.md` ↔ INDEX） |
| 本審查 | 初審；**未**擅自改 INDEX |

Starter prompt 現況只指向 INDEX，未要求先讀 `AGENTS.md`→HANDOFF→INDEX，也未寫「INDEX 沉默才提問」。實作 agent 容易漏 skill／契約同步清單。

---

## 3. Findings（初審建議 → 規劃已併入 INDEX／HOW）

狀態用語：待規劃併入。修復時改 INDEX／HOW，勿只改本檔。

### HIGH

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| H1 | 凍結讀必須進既有寫入鎖 | **已併入** INDEX A2／C3、HOW 偽碼 |
| H2 | Report／involvements 禁止二讀 live pool | **已併入** INDEX A2、Track A |
| H3 | Distill／generate／rollback 與人寫 clarify 同鎖 | **已併入** INDEX A5／C4 |

### MEDIUM

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| M1 | HANDOFF starter 補滿 workflow 四要素 | **已併入** HANDOFF |
| M2 | 契約同步清單漏 integration skill 與 i18n | **已併入** Track B／C、錨點、驗收 |
| M3 | 凍結當下讀寫鎖順序偽碼 | **已併入** HOW |
| M4 | Retry／amend 讀哪份檔 | **已併入** INDEX A6：`dreams/runs/{id}.input.json` |
| M5 | E2 過渡禁止 `listPendingIds()` | **已併入** INDEX E2 |
| M6 | Auto-approve 與排隊 | **已併入** INDEX C8 |
| M7 | `GET /status`／Sidebar 文案 | **已併入** INDEX D3／D4、Track C |

### LOW

| ID | 題 | 狀態 | 證據／說明 |
|----|----|------|------------|
| L1 | INDEX 加一行「開工前仍須拍板：無」 | **已併入** INDEX 狀態段 |
| L2 | 錨點補 `web/src/lib/types.ts`、`engram-activities-integration` | **已併入** 錨點表 |
| L3 | phases 自測現有 `dream_locked` capture 段必須改寫 | **已併入** Track B／驗收 |
| L4 | 0.39 仍 in progress 與開 0.41 | **可留**（非本版契約） |
| L5 | DELETE tmp upload | **已併入** Track B 不要做／HOW 表 |

---

## 4. 已對齊、仍成立（不必再拍板）

- 單場 mutex 仍用 `dream.lock`；capture／clarify **不**再用它 409。
- `scope[]` 仍只裝 event id；釐清另份快照。
- Ask 讀 live pool 不變。
- 無 store migrate；boot ≥0.40；快照在 `dreams/runs/`。
- 新寫入不進本場；approve 只清／歸檔快照內仍存在的 id。
- Generate 的 `asking/` 是產出不是輸入（A5）——與 H3 不衝突：H3 管**檔案互斥**，不管 scope。
- 多進程非目標；`withCaptureLock` 夠。
- UI：Activities／Clarify 不 disable；Consolidate 再入夢／審核仍守單場。

---

## 5. 驗收缺口（建議補進 INDEX 驗收，非另開範圍）

現有 checklist 已覆蓋「extract 中 POST 201、不進 scope、再 run 409、交錯清 pool、phases」。建議加：

- Extract 中 `POST /attachments/uploads` → 201（C2 有、驗收目前「可無附件」易漏 upload）。
- 舊 pending 無 clarify 正文：distill 不因 live 新 aside 而變（M5）。
- 失敗 rollback 刪本場 generate 的 asking 時，不刪使用者另寫的 asking（H3）。
- `bun run test:phases` 內**不再** assert capture／aside 於 lock 時 409。

---

## 6. 建議後續

1. ~~規劃併入 H／M~~ **已做**（2026-08-21）。  
2. 開**新**實作 agent，貼 HANDOFF starter。本審查不改碼、不 commit。
