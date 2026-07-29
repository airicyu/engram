# 0.16.0 — Store 目錄、git 進出、回滾

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫磁碟與 git **HOW**。

## 目標樹（記憶庫根）

根分組維持 0.14（`memories/`／`dreams/`／`tmp/`）。本版新增 store 專用 `.git`／`.gitignore`；`dreams/draft` 語意改為 AI 工作樹。

```
<ENGRAM_STORE_DIR>/
├── .git/
├── .gitignore
├── engram.workspace.yaml          # 進 git（含可選 store_version）
│
├── memories/                      # 進 git（整棵）
│   ├── activities/events.jsonl
│   ├── short-term-memory/…
│   ├── chain/
│   │   ├── days/YYYY-MM/
│   │   │   ├── {day}.md           # ledger
│   │   │   └── {day}.summary.md   # 整檔最新敘事
│   │   ├── weeks/{YYYY-MM}/{YYYY-Www-MMDD}.summary.md   # MMDD＝週一
│   │   ├── months/… years/…
│   │   └── initialized_*.yaml
│   ├── nodes/{id}/understand/what.md
│   └── future-sight/active/{id}.md
│
├── dreams/                        # 不進 git
│   ├── draft/{run_id}/
│   │   ├── memories/…             # 鏡像將部署路徑
│   │   ├── deletes.txt            # 或等價：相對 ENGRAM_STORE_DIR 的 path 列表
│   │   └── appends/…              # 可選 sidecar；deploy 時 append 進 live ledger
│   ├── reports/{run_id}.md
│   └── runs/{run_id}.yaml
│
└── tmp/                           # 不進 git；主要放 clock（ask jobs 改在 ENGRAM_TEMP_DIR）
    └── clock.json
```

Ask 執行態：`{ENGRAM_TEMP_DIR}/engram/ask/jobs/{job_id}/`（預設 `ENGRAM_TEMP_DIR=/tmp`）。  
Dream agent disposable：`{ENGRAM_TEMP_DIR}/engram-dream-{ts}/`（跑完刪除）。

### 不再作為契約的舊物

- **`dreams/patches.jsonl` 驅動 materialize**：停止作為入夢主契約（檔案可留考古或停寫，見 INDEX #21）。
- Draft 內 **`manifest.yaml` 作為唯一 commit 清單**：可改為「draft 樹＋deletes＋appends」推導 touched set；若保留 manifest，須由 server 自 draft 機械生成，不得再要求 AI 輸出 typed patch。

## `.gitignore`（最低）

```
tmp/
dreams/
```

若存在根級 ops `log/`，一併 ignore。

## Git 進出（G1）

| 路徑 | 進 git？ |
|------|----------|
| `memories/**` | **是** |
| `engram.workspace.yaml` | **是** |
| `dreams/**` | **否**（丢失可重跑入夢） |
| `tmp/**` | **否** |

## Ensure（啟動／reset）

1. 確認 `git` 可執行；否則 **拒絕啟動**。
2. 若無 `.git` → `git init`。
3. 確保 `.gitignore` 含上表。
4. 若尚無 commit → 將應追蹤檔（既有 `memories/`＋workspace，若存在）做成 **初始 commit**（訊息可固定如 `engram: initial store`）。
5. Wizard 可呼叫同一函式；server 仍是唯一真相。

## Approve 與回滾

### 成功路徑

1. （建議）若 working tree 上已有與本夢無關的 `memories/activities`／short-term 變更，先單獨 commit 或確保失敗回滾 **不會**用整庫 hard reset 抹掉它們。
2. 套用 `deletes`（白名單校驗）。
3. 將 draft 內 `memories/…` 部署到 live（copy／rsync）；套用 appends。
4. `git add` 本次 touched paths（含清 S 造成的 short-term 變更）。
5. `git commit`，message 含 `dream_run_id`。

### 失敗路徑

- **只**還原本次部署 touched 的 paths 至 `HEAD`（例如 `git checkout HEAD -- <path>…` 並清掉誤建的新檔）。
- **禁止** `git reset --hard` 整棵 store。

### Discard

- 刪除／作廢該 `run_id` 的 draft／pending 態。
- Live 在 approve 前不應被本輪改寫；故 discard **通常不需** git 回滾。

## 與產品 repo 巢狀

若 `ENGRAM_STORE_DIR` 位於 engram 原始碼樹下（例如 `data/`），產品 `.gitignore` 已忽略該目錄——store `.git` 為 **巢狀獨立 repo**，互不追蹤。所有 git 指令必須 `git -C $ENGRAM_STORE_DIR`（或等價），禁止依賴任意 cwd 往上找到產品 `.git`。
