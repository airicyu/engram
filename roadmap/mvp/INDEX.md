# Engram — AI Brain Memory System

> 北極星：做一個 **AI 大腦的 memory 系統**，模擬記憶與思考脈絡。  
> 不是 project 管理工具、不是 workflow pipeline。介面、input 方式暫不考慮。

## 起點與演進

最初想做「工作流 / 多 project 進度追蹤」工具。討論後：

- **Append log 很簡單**；難點是 **digest 進 memory**
- 越做越像 **做大腦**，而非做工具
- **Project 先放開**；節點（node）才是核心

## 三種記憶

| 類型 | 大腦 | 系統 | 現階段 |
|------|------|------|--------|
| **情節 Episodic** | 什麼時候發生過什麼 | `log/events.jsonl` + short-term | ✓ |
| **語意 Semantic** | 世界是什麼樣 | `nodes/{id}/understand/` | ✓ |
| **前瞻 Prospective** | 我要做什麼 | 暫不做 | 後掛 |

## 儲存層

```
Layer 0:   log/events.jsonl              — 情節原稿（immutable）
Layer 0.5: dream/patches.jsonl           — Dream 決策原稿（immutable append；audit）
Layer 1:   short-term-memory/            — 工作記憶（apply 階段跑完後清空；可含 DLQ）
Layer 2:   nodes/ + memory-chain/        — 當前語意表面（Dream apply + 允許手改）
Layer 3:   activation packet             — 讀取時現算
```

**原則：**

- **L0 / L0.5 永不改**；L1 可清空；L2 可壓縮、可手改、可被 revise
- L0.5 = Dream 的決策錄音（回答「為何夢成這樣」）；**不是** L2 的唯一真相
- L2 = 活的工作面；「現在相信什麼」以 L2 Current 為準
- 日間 Ingest、夜間 `dream run`（extract→apply 連跑）；**single thread，不並行**

## 三條主路徑

```
寫入： input → Ingest(L0, L1)                         # 日間
整合： dream run = extract → L0.5 → apply → clear L1 # 夜間連跑
讀取： query → Activation(L1, L2 subgraph, chain)
```

## 設計文件

| 主題 | 文件 |
|------|------|
| 公共時間骨幹 day/week/month/year | [docs/memory-chain.md](./docs/memory-chain.md) |
| 工作記憶、做夢節奏 | [docs/short-term.md](./docs/short-term.md) |
| 節點結構、understand facets、INDEX | [docs/nodes.md](./docs/nodes.md) |
| chronology 膨脹、primary/mention | [docs/nodes-chronology.md](./docs/nodes-chronology.md) |
| 建立、T1–T4 重組、graph、收斂 | [docs/nodes-graph.md](./docs/nodes-graph.md) |
| ingest、dream pipeline、L0.5 patches | [docs/dream.md](./docs/dream.md) |
| 激活檢索、budget | [docs/activation.md](./docs/activation.md) |
| Prototype 實作提案 | [docs/prototype.md](./docs/prototype.md) |
| 設計評審 | [docs/design-review.md](./docs/design-review.md) |

## 目錄結構（草案）

**設計文件（本目錄）：**

```
engram/seed-idea/
├── INDEX.md
├── brainstorm.md
└── docs/
    ├── memory-chain.md
    ├── short-term.md
    ├── nodes.md
    ├── nodes-chronology.md
    ├── nodes-graph.md
    ├── dream.md
    ├── activation.md
    ├── prototype.md
    └── design-review.md
```

**系統實作（草案，與設計文件分開）：**

```
engram/
├── meta.yaml
├── log/events.jsonl                 # L0
├── dream/
│   ├── patches.jsonl                # L0.5（JSON Lines）
│   ├── applied.yaml                 # per-patch 冪等
│   ├── dead-letter.jsonl            # pending DLQ
│   ├── dead-letter-archive/         # 已審離 pending（可追溯）
│   ├── reviews/                     # DLQ settlement reports
│   └── dream.lock
├── short-term-memory/               # L1
├── memory-chain/
│   ├── days/                        # MVP required
│   ├── weeks/ months/ years/        # 後期
├── candidates/
│   ├── nodes.yaml                   # 當前狀態為準；人批准才建 nodes/
│   └── attribution.yaml
├── nodes/{id}/
├── graph/links.yaml                 # MVP 不寫
└── archive/
```

## 明確不做（現階段）

- Workflow / pipeline / rigid YAML 流程
- 介面（chat、web、CLI）— 批准 node 可先手改 yaml
- 每條 input 全量 rewrite long-term
- 依賴 Obsidian / Cursor runtime
- Guild 式 checkpoint 狀態機
- Dream 自動建 `nodes/{id}/`
- MVP：week/month/year 關帳、T1–T4、embedding、`reattribute` apply、graph link、`dream rebuild`

### 邊界（是／不是）

| 東西 | 是 | 不是 |
|------|----|------|
| `open.md` | 對該 node **尚未釐清的理解** | 待辦 / 專案 task |
| `problems.md` | **現存痛點的語意陳述** | 工單追蹤 |
| chronology | 「曾發生／曾理解到」 | 「進展到哪、下一步」 |
| `candidates/` | Dream 提案佇列（yaml 為準） | 正式 node |
| L0.5 | Dream 決策 audit | L2 的唯一真相／禁止手改的理由 |

## MVP 驗證標準

驗證句：

> **≤3 個 node + L0 + L1 + `dream run`（what + day chain + candidates + L0.5 可追溯）是否比全量 rewrite 更穩？**

**Required**

- [ ] input → L0 + L1 append
- [ ] `dream run`：extract→apply 連跑；single thread
- [ ] append `dream/patches.jsonl`；成功 → `applied.yaml`；失敗 → `dead-letter.jsonl`（繼續）
- [ ] 寫 `understand/what.md`（Current/History + event_refs）+ `memory-chain/days/`
- [ ] `propose_node` / 低置信 → `candidates/*.yaml`（不自動建目錄）
- [ ] apply 跑完（可有 DLQ）→ **清 L1**；Activation 可標 `dead_letter_pending`

**Optional（同 sprint）**

- [ ] primary → `chronology/recent.md`

**不做：** week/month、多 facet、graph、reattribute apply、rebuild、embedding。

## 待打磨

### 已定案

- [x] L0.5 + extract / apply；失敗 → DLQ；跑完清 L1（[dream](./docs/dream.md)）
- [x] **per-patch 冪等**；失敗 → **DLQ、繼續**；跑完清 L1；不回滾
- [x] **DLQ review**：batch + report + adhoc；**extract 成功才 archive**；失敗 pending 保留（不擋主流程）
- [x] **single thread**：日間 Ingest / 夜間 dream run 連跑；不並行
- [x] **允許手改 L2**；rebuild MVP 不做
- [x] L1↔L2 矛盾 → append / revise / open（同化）
- [x] MVP 範圍：required = what + days + candidates；optional = chronology；不做 graph
- [x] `reattribute`：MVP **不 apply**；attribution 手改 yaml
- [x] candidates **yaml 為準**；L0.5 只記提案理由
- [x] MVP 只做 day；時區 `Asia/Taipei`；週關帳規則預留
- [x] understand Current + History + event_refs
- [x] node 新建：candidates → 人批准
- [x] confidence `< 0.6` → attribution candidate

### 仍開放（不擋 MVP）

- [x] adhoc archive 時機：extract 成功才 archive（失敗 pending 保留）
- [ ] adhoc extract 輸入契約（report + 原 DLQ event_refs）→ [design-review](./docs/design-review.md#2-settlement-report--extract-的機械契約略薄)
- [ ] apply：node 不存在 → DLQ → [design-review](./docs/design-review.md#3-applynode-不存在--dlq)
- [ ] extract L1 coverage check（可選）→ [design-review](./docs/design-review.md#1-dlq--仍清-l1合理但接受-l1-草稿蒸發)
- [ ] `nodes-graph.md` MVP 註記（不做 link）→ [design-review](./docs/design-review.md#5-nodes-graphmd-小殘留)
- [ ] week/month `closed_*.yaml` 補跑
- [ ] year 維度時機
- [ ] restructure T1–T4 + graph（P3）
- [ ] strengthen link vs merge
- [ ] candidates 過期清理約定
- [ ] ingest `idempotency_key` / content hash
- [ ] 同日多次 `dream_run` 的 day 檔 merge 細節
- [x] 系統命名 → **engram**
- [ ] 前瞻記憶層（將來）

## 參考類比（做夢模型）

> 日間：long-term + daily 一起讀，daily 更新鮮。  
> 夜間：daily 蒸餾進 long-term，清空 daily。  
> event log 與 patch log 獨立存留；L2 可人手修訂。

---

歷史腦暴過程見 [brainstorm.md](./brainstorm.md)。  
評審見 [docs/design-review.md](./docs/design-review.md)。
