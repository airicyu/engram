# 時間線歸屬 — 基本（0.3.0 想法）

← [0.3.0 INDEX](./INDEX.md) · 依賴 [dream-approve.md](./dream-approve.md) · 未來視 → [0.4.0](../0.4.0/INDEX.md)

> 本檔只處理 **occurrence / encoding** 與 memory-chain。  
> **未來視 chain 整包劃歸 0.4.0**；此處只定「不要做錯」的預留。

## 觸發例子

> 今日 **19/7** ingest：「早兩天 **17/7** 確認了需求，也談好了 deadline 在 **31/7**。」

| 日子 | 角色 | 0.3.0 | 0.4.0 |
|------|------|-------|-------|
| **17/7** | 已發生（談需求） | **occurrence** → memory-chain | — |
| **19/7** | 補記進系統 | **encoding**（L0 ts；可選極短 meta） | — |
| **31/7** | 未來錨點 | **禁止**寫入 memory-chain；report 可標 Future mentions | 未來視（做法見 0.4，今留白） |

無時間錨點的純想像（「結婚後怎樣」但婚期／對象皆無）→ **當日普通事件**即可；不進未來視（0.4 同此准入）。

## 與現行行為的差距

| 層 | 現行 | 0.3.0 方向 |
|----|------|------------|
| L0 | `ts` = ingest | 維持 |
| L1 | 整包清 | 按 event 範圍 S 清（見 mempool） |
| memory-chain | 多寫 ingest／dream 日 | **已發生日（world timeline，已定案）** |
| 未來日 | 無硬禁止 | **禁止**當 `chain.id` occurrence |

## 定案方向（2026-07-19）

### 1. Memory-chain = world timeline（已定案）

- `days/D` = D 日在世界裡**已發生／被認定已發生**的事。
- 一輪 dream 可 emit 多個 `chain` patch（多個過去／今日 `id`）。
- **不**把 memory-chain 往未來日期延長；未來視另軌（0.4）。
- **已否決 journal：** 不以「寫入／消化日」作為 day 檔主鍵。

### 2. Encoding

- L0 `ts` 表達寫入時間。
- Report 註明補記；可選極短 meta 留在 encoding 日，勿蓋過 occurrence 正文。
- **同日規則（#18）：** occurrence 日 = encoding 日時，**只寫 occurrence chain**；encoding meta 僅在兩日不同時。

### 3. 本版對「文中的未來日」

| 做 | 不做 |
|----|------|
| Report 列出「提到的未來日期／疑似錨點」供人審 | 建立未來視目錄或 patch apply |
| 禁止 `chain.id` = 未來日 | 過期抹除、多尺度未來骨幹 |
| 可選：`semantic` 一句「deadline 是 31/7」（語意事實） | 把這句當成完整前瞻系統 |

### 4. Extract 規則（草案）

1. 解析絕對／相對日期（Asia/Taipei）。
2. 已發生 → `chain.id` = 發生日；`event_refs` → encoding 的 L0 id。
3. 未來日 → **不**寫 memory-chain；report 標出即可（0.4 再入未來視）。
4. 無錨點想像 → 當日事件。
5. 不確定 → report「待確認」，勿瞎 backfill。
6. **未來日校驗（#16）：** extract 預檢；**approve** 當下 Asia/Taipei 日硬擋 `chain.id` > 當日。

### 5. Report 示意

```markdown
## Timeline (proposed)
### 2026-07-17 (occurrence)
- 確認需求；約定 deadline（見下方未來提及）
### 2026-07-19 (encoding)
- 使用者補記（L0 …）
## Future mentions (not memory-chain; → 0.4.0)
- 2026-07-31 — deadline（有日期錨點，本版不入庫）
```

## Journal（已否決）

曾考慮 `days/D` = 消化寫入日；**已定案不採**，改用 world timeline。

## 開放問題（0.3）

1. Backfill 與後期已關帳 week／month？
2. Encoding meta 要否獨立 patch type？
3. 相對日期失敗時：留 encoding + open，還是擋 approve？

## 非目標（本檔／0.3）

- 未來視 chain、抹除語義、提醒、日曆 sync → [0.4.0](../0.4.0/INDEX.md)
- 改 L0 歷史 ts
