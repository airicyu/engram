# Memory Chain（公共時間骨幹）

← [INDEX](../INDEX.md)

memory 內有一個 **main memory chain** — 唯一的公共 region，記錄「時間上發生了什麼」的全局視角。

採用 **日曆對齊** 四層時間維度：**day → week → month → year**。  
**MVP 只實作 day**；week / month / year 目錄預留，關帳 job 預設關閉。

```
memory-chain/
├── INDEX.md
├── days/
│   └── 2026-07-14.md            # MVP：當日全局摘要
├── weeks/                       # 後期
│   └── 2026-W28.md
├── months/                      # 後期
│   └── 2026-07.md
└── years/                       # 後期
    └── 2026.md
```

## 時間邊界（已定案）

| 維度 | 邊界 | 檔名 | 關帳時機 |
|------|------|------|----------|
| **Day** | 日曆日（時區 **`Asia/Taipei`**） | `2026-07-14.md` | 每晚 `dream-apply`（MVP） |
| **Week** | **週一～週日**（ISO week） | `2026-W28.md` | **週一 00:00** 關閉上一週（後期） |
| **Month** | 日曆月 1 號～月底 | `2026-07.md` | 下月 1 日關上一月（後期） |
| **Year** | 日曆年 | `2026.md` | 年底後（更後期） |

### 冪等與補跑（後期 week/month）

- 維護 `memory-chain/closed_weeks.yaml` / `closed_months.yaml`
- 已關閉的 `id` 不再關帳；補跑兩天不會重複寫 week/month
- day 檔按日期冪等：同 `dream_run` / 同日 patch 不重複 append（見 [dream.md](./dream.md)）

## 層級關係與內容來源

```
events (L0) + short-term
    → day summary（每晚 apply；MVP）
    → week summary（關閉該週時；後期）
    → month summary（關閉該月時；後期）
    → year summary（後期）
```

- **週與月獨立 rollup**，不是嚴格父子：週可跨月；月按日曆日收攏
- 同一事實可在多層各有一份**不同粒度**摘要，均附 `event_refs` → L0
- chain 是**公共的** — 不屬於單一 node

## 典型查詢

- 「今天發生什麼」→ `days/…` 或 short-term（apply 前）
- 「上週呢」→ `weeks/…`（後期；MVP 可掃多個 days）
- 「7 月呢」→ `months/…`（後期）

## 與 node chronology 的關係

- **chain** = 全局「這段時間世界發生了什麼」
- **node chronology** = 節點視角 → [nodes-chronology.md](./nodes-chronology.md)
- 做夢時：同一批 events → chain 寫全局 + 各 node 寫視角（皆經 L1.5 patches）

## MVP

只要求：每晚（或手動）產出當日 `days/YYYY-MM-DD.md`，內容來自已 apply 的 `type: chain, level: day` patches。
