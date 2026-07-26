# 0.14.0 — ENGRAM_HOME 目標目錄佈局

← [INDEX](../INDEX.md) · 推理：[reasoning.md](./reasoning.md)

> **實作契約：** 路徑長什麼樣、舊→新對照、ensure 建什麼。API 對外仍只暴露 id／語意欄位，不暴露資料夾分組細節（與 0.11 chain 相同原則）。

---

## 目標樹（`ENGRAM_HOME`）

```
ENGRAM_HOME/
├── engram.workspace.yaml              # 0.13 workspace 偏好（不變）
├── memory/                            # 活記憶本體
│   ├── activities/
│   │   └── events.jsonl               # L0（原 log/events.jsonl）
│   ├── short-term-memory/
│   │   ├── pool.jsonl                 # L1 mem pool
│   │   ├── summary.md                 # 呈現／相容（若仍需要）
│   │   └── nodes/                     # 早期 per-node notes；可空
│   ├── memory-chain/
│   │   ├── days/YYYY-MM/…
│   │   ├── weeks/YYYY-MM/…
│   │   ├── months/YYYY/…
│   │   ├── years/…
│   │   └── initialized_{weeks,months,years}.yaml
│   ├── nodes/{id}/…                   # L2
│   └── future-sight/
│       └── active/{id}.md
├── dream/                             # 管線／L1.5／執行跡（非「已 commit 的唯一活檔」之外的 staging）
│   ├── patches.jsonl
│   ├── dead-letter.jsonl
│   ├── dream-job.yaml
│   ├── extract-state.yaml
│   ├── reports/{run_id}.md
│   ├── runs/…
│   ├── draft/{run_id}/…
│   └── candidates/
│       └── attribution.yaml           # 低信心 episodic；非建 node 主路徑
├── tmp/                               # 可丟、執行態（勿當記憶本體；git 化時應忽略）
│   ├── ask/
│   │   └── jobs/{job_id}/…
│   └── clock.json                     # 虛擬時鐘持久化（ALLOW_VIRTUAL_CLOCK）
└── log/                               # 可選 ops 軌跡（非 L0）
    └── replay-cursor.log              # 若仍使用 replay；否則可不建
```

### 刻意不建／停寫

| 路徑 | 處置 |
|------|------|
| `meta.yaml` | **停寫、不讀**；timezone／語言只認 workspace／env |
| `meta/` | **刪除**（clock 改 `tmp/clock.json`） |
| `archive/` | **刪除** |
| `dream/reviews/` | **刪除**（從未實作 DLQ settlement report） |
| `dream/dead-letter-archive/` | **刪除**（從未寫入） |
| `dream/applied.yaml` | **停用／刪**（0.3 已廢 per-patch apply 主冪等） |
| `candidates/nodes.yaml` | **刪**（建 node 已走 `propose_node`；不保留空殼） |
| 頂層 `candidates/` | **刪**（改 `dream/candidates/`） |
| 頂層 `log/events.jsonl` | **遷走**（改 `memory/activities/events.jsonl`） |
| 頂層 `memory/ask/` | **遷走**（改 `tmp/ask/`；騰出 `memory/` 給活記憶） |

---

## 舊 → 新對照

| 舊路徑 | 新路徑 |
|--------|--------|
| `log/events.jsonl` | `memory/activities/events.jsonl` |
| `short-term-memory/**` | `memory/short-term-memory/**` |
| `memory-chain/**` | `memory/memory-chain/**` |
| `nodes/**` | `memory/nodes/**` |
| `future-sight/**` | `memory/future-sight/**` |
| `candidates/attribution.yaml` | `dream/candidates/attribution.yaml` |
| `memory/ask/jobs/**` | `tmp/ask/jobs/**` |
| `meta/clock.json` | `tmp/clock.json` |
| `replay-cursor.log`（根） | `log/replay-cursor.log`（若保留） |
| `meta.yaml` | （無後繼） |
| `archive/`、`dream/reviews/`、`dream/dead-letter-archive/` | （無後繼） |

**不變（僅相對父目錄變）：**

- Day／week／month／year **檔名與分組鍵**仍遵循 [0.11 store-layout](../../0.11.0/docs/store-layout.md)（例如 `memory/memory-chain/days/YYYY-MM/…`）。
- Node 內部結構：`node.meta.yaml`、`understand/what.md` 等。
- Dream draft 內部相對 live 的鏡像結構：draft 內路徑改為新 live 相對路徑（例如 `memory/nodes/…`、`memory/memory-chain/…`、`dream/candidates/…`、`memory/future-sight/…`）。

---

## `ensureEngramHome` 應建立

目錄（至少）：

- `memory/activities`
- `memory/short-term-memory`（＋既有 L1 子路徑慣例）
- `memory/memory-chain/{days,weeks,months,years}`
- `memory/nodes`
- `memory/future-sight/active`
- `dream/{runs,draft,reports,candidates}`
- `tmp/ask/jobs`（或首次 ask 時再建；二選一，實作定一處並文件化）
- `log`（僅當仍寫 `replay-cursor.log`；否則可不建）

檔案（空／預設）：

- `memory/activities/events.jsonl`（空）
- `dream/patches.jsonl`、`dream/dead-letter.jsonl`（空）
- `dream/candidates/attribution.yaml`（`candidates: []`）
- **不**建 `meta.yaml`、`candidates/nodes.yaml`、`applied.yaml`

---

## 程式約束

1. **單一 path helper 層**（延伸／收斂現有 `homePath`、`dayLedgerPath` 等）：禁止各處手拼舊相對路徑字串。
2. **預設只認新路徑**（與 0.11 day 分組遷移同策略）；不做長期雙讀。
3. Prompt（extract／rollup／memory-ask）與 api-docs／AGENTS／domain-language 中的路徑字樣同步更新。
4. API HTTP 路徑（`/memory/ask`、`/capture` 等）**不變**；僅磁碟佈局變。

---

## 遷移 CLI（一次性格）

- **形態：** Bun 跑的 TypeScript（`server/src/cli/…`），經 `package.json` script 呼叫——**與既有 `chain:migrate-days` 同一模式**，不是獨立 bash 搬家腳本。
- **輸入：** `ENGRAM_HOME`（經既有 `config`）。
- **行為：** 依上表 rename／搬移；刪廢檔（`meta.yaml`、`applied.yaml` 等）；冪等；目標已存在且內容衝突 → **拒絕覆寫**（對齊 days migrate）。
- **前置：** 遷移前 discard pending（舊 `dream/draft` 相對路徑不保証相容）。
- **不做：** 啟動時靜默自動遷移（避免 server boot 偷改盤）。

---

## 與「記憶層」對照（文件用語）

| 層 | 磁碟 |
|----|------|
| L0 | `memory/activities/events.jsonl` |
| L1 | `memory/short-term-memory/pool.jsonl` |
| L1.5 intent | `dream/patches.jsonl`、`dream/reports/` |
| L1.5 draft | `dream/draft/{run_id}/` |
| L2 | `memory/nodes/{id}/understand/what.md` |
| chain | `memory/memory-chain/…` |
| future-sight | `memory/future-sight/active/` |
| attribution candidates | `dream/candidates/attribution.yaml` |
| ask 執行態 | `tmp/ask/jobs/` |
| 虛擬時鐘 | `tmp/clock.json` |
