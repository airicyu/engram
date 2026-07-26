# 0.11.0 — Memory-chain 目錄佈局與 id

← [INDEX](../INDEX.md) · 推理：[reasoning.md](./reasoning.md)

> **實作契約：** 路徑長什麼樣、id 格式、遷移規則。API 對外只暴露 **id**，不暴露資料夾分組細節。

---

## 穩定 id（對外／patch／API）

| Level | id 格式 | 例 | 備註 |
|-------|---------|-----|------|
| day | `YYYY-MM-DD` | `2026-07-14` | 既有；occurrence 日；`ENGRAM_TZ` |
| week | ISO week `YYYY-Www` | `2026-W28` | **週一～週日**；年週用 ISO week-year（勿用日曆年瞎拼） |
| month | `YYYY-MM` | `2026-07` | 日曆月 |
| year | `YYYY` | `2026` | 日曆年 |

非法 id → API **`400`**（對齊既有 `invalid_day_id` 風格，可新增 `invalid_week_id` 等）。  
合法但無內容 → **`200`** + `present: false`（禁止用 404 表示空）。

---

## 磁碟路徑（`ENGRAM_HOME`）

```
memory-chain/
├── days/
│   └── YYYY-MM/
│       ├── YYYY-MM-DD.md              # day ledger（既有雙軌）
│       └── YYYY-MM-DD.summary.md      # day summary
├── weeks/
│   └── YYYY-MM/                       # 分組鍵 = 該週「週一」所在年月
│       └── YYYY-Www.summary.md        # week summary only
├── months/
│   └── YYYY/
│       └── YYYY-MM.summary.md         # month summary only
├── years/
│   └── YYYY.summary.md                # year summary only
├── initialized_weeks.yaml             # 建議；見下
├── initialized_months.yaml
└── initialized_years.yaml
```

### 分組鍵規則（務必實作正確）

| Level | 父資料夾 | 規則 |
|-------|----------|------|
| day | `days/YYYY-MM/` | `YYYY-MM` = 該日的年－月 |
| week | `weeks/YYYY-MM/` | `YYYY-MM` = 該 ISO week **起始日（週一）** 的年－月。例：跨年週可能落在 `2025-12/` |
| month | `months/YYYY/` | `YYYY` = 該月的年 |
| year | `years/` | 無再分組 |

### 讀取集 ≠ 分組鍵（month ← weeks）

Month writer 讀 week 時：納入所有與該月 **[月初 00:00, 下月初)** **日期區間有重疊** 的 ISO weeks（跨月 week 會進兩個 month 的 context）。  
**不要**只用「week 檔所在 `weeks/YYYY-MM/` 資料夾名＝當月」當讀取條件。

同理 week ← days：該 ISO week 週一～週日內所有有 summary（或 ledger fallback）的 day。

---

## Day：從 flat 遷到 `YYYY-MM/`（Track 0）

### 現況（0.10）

```
memory-chain/days/2026-07-14.md
memory-chain/days/2026-07-14.summary.md
```

### 目標

```
memory-chain/days/2026-07/2026-07-14.md
memory-chain/days/2026-07/2026-07-14.summary.md
```

### 遷移要求

1. **實作單一 path helper**（例如 `dayLedgerPath(id)`／`daySummaryPath(id)`），禁止各處手拼相對路徑。
2. 遷移腳本或啟動／CLI 一次性搬家：掃描舊 flat 檔 → 移入 `days/YYYY-MM/` → 確認無殘留 flat `YYYY-MM-DD*.md` 在 `days/` 根層。
3. **建議策略：只認新路徑**（遷移一步到位）。若需短窗口雙讀，必須有明確開關與移除期限；預設不要長期雙讀。
4. 必遷：`data-demo`、self-test 產物路徑、文件範例路徑。
5. Draft manifest 內 day 相對路徑改為新形；舊 pending draft 不保証相容（原型可文件註明：遷移前 discard pending）。

### 行為不變（Track 0 驗收）

- `GET /memory/chain`、`GET /memory/chain/{day_id}` 契約不變（仍用 day id）。
- Day dream ledger append + summary init／revise 行為不變。
- Search／Ask 仍找得到 day 內容。

---

## Week／month／year 檔案內容

僅 summary **snapshot**（整份檔＝markdown 正文；**無** `## Current`／`## History`）：

```markdown
## Harbor

…該面向融合敘事…

## Engram

…另一面向…
```

- **init：** 新建檔＝writer 產出的整份 markdown。
- **revise：** **整份 replace**（不沉 History；高階不保留歷次稿）。
- Writer 以短 `##` 標題分面向（標題依內容命名，非固定 taxonomy）。
- **不要**建立 `*.md` ledger（無 `.summary` 後綴的週／月／年檔）。
- Day summary 仍維持 Current／History 雙段（與 0.5.0 相同）；Current **正文內**可用 `##` 分段。

---

## initialized_*.yaml

用途：**記錄哪些 id 已成功 init 過**（approve 成功後寫入），供 init 冪等與除錯。

**不是**「禁止再 revise」的黑名單。

建議形狀（實作可微調，但語意須等同）：

```yaml
# initialized_months.yaml
ids:
  - "2026-06"
  - "2026-05"
```

規則：

- Approve 成功且本輪对该 id 為 **init** → 加入列表（冪等 add）。
- Discard／cancel → **不**寫入。
- 已在列表中的 id 再 approve **revise** → 列表不變，檔案照常 replace Current。
- 若檔案已存在但不在 yaml（手動／半殘），以檔案為準視為已 init；approve 時可回填 yaml。

亦可用「僅以檔案存在判斷 init」，yaml 可選；若省略 yaml，須在 INDEX 驗收改為「以檔案存在為準」並更新本段。

---

## 禁止事項

- 手改 `ENGRAM_HOME` 當操作手段（見 `CLAUDE.md`）——遷移腳本屬工程例外，跑完即棄或收進 `bun run` CLI。
- 把未來日寫進 day／把未發生區間當成已發生高階敘事的唯一來源（高階仍是「已發生」的 rollup；future-sight 另軌）。
- API path 參數用檔案系統相對路徑（只用 id）。
