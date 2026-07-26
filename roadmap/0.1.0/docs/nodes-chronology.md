# Node Chronology（情節痕跡）

← [INDEX](../INDEX.md) · [nodes](./nodes.md) · [memory-chain](./memory-chain.md)

## Chronology vs Timeline

| | Chronology（node 有） | Timeline（現階段不做） |
|---|----------------------|------------------------|
| 性質 | 與此節點相關的情節痕跡 | 有意圖的推進弧線 |
| 結構 | 分層：recent → months → years | checkpoints、milestones |
| 問題 | 「與 X 相關發生過什麼」 | 「這件事進展到哪」 |
| 歸屬 | 屬於前瞻記憶層；將來某類 node 才需要 |

若某節點開始有 sustained 意圖與 deliverable → spawn 新 node（經 candidates 批准），而非把 chronology 做成第二套 project。

## 膨脹問題（熱門節點）

熱門節點（如 `acme`）會被大量 events 標記。單一 `chronology.md` **必定爆掉** — 設計時當預設情況。

### 原則

1. **Chronology ≠ 複製 memory chain** — 全局敘事在 `memory-chain/`；node 只保留**視角** + link
2. **Primary vs mention** — 只有 `primary` 進 chronology 正文；mention 不寫正文（可 pointer）
3. **可錯、可改、不丟** — 低置信進 attribution；MVP **不**做 `reattribute` apply
4. **分層 + 滾動歸檔** — recent → months → years（歸檔後期）
5. **Activation 不載全庫**

### 目錄結構

```
nodes/acme/chronology/
├── INDEX.md           # ≤20 行
├── recent.md          # MVP optional：近 30 天 primary bullets
├── months/            # 後期
└── years/             # 後期
```

### 滾動歸檔

| 觸發 | 動作 |
|------|------|
| 每晚（optional） | primary append 到 `recent.md` |
| `recent` > N 或跨月 | 壓入 `months/`（後期） |
| 年底 | → `years/`（後期） |

---

## Primary vs mention（已定案）

| 角色 | 寫入 chronology？ |
|------|------------------|
| **primary** | ✓ `recent.md` 正文 |
| **mention** | ✗ 正文；只在 primary node 或 memory-chain；可選 INDEX pointer |
| 低 confidence | **先當 mention**；並寫入 `candidates/attribution.yaml` |

### 流程

1. Dream extract 產出 `role` + `confidence`
2. **`confidence < 0.6`** → `candidates/attribution.yaml`；正文先當 mention
3. 「事實正文只寫 primary 一次」保留；「一次必須對」放棄
4. **MVP：** 人把 yaml `status` 改為 `resolved`；**不做** `reattribute` apply（不改 recent / day）

```yaml
# candidates/attribution.yaml（草案）— 當前狀態以本檔為準
- event_refs: [e042]
  candidates:
    - { node: acme, role: primary, confidence: 0.55 }
    - { node: guild, role: primary, confidence: 0.45 }
  status: pending    # pending | resolved（人手改）
  dream_run_id: dream-2026-07-18
```

### 與 memory chain 分工

| 問題 | 讀哪 |
|------|------|
| 「今天世界發生什麼」 | `memory-chain/days/…` |
| 「與 Acme 相關近期」 | `nodes/acme/chronology/recent.md` |
| 「Acme 當時原話」 | `log/events.jsonl` |
| 「為何寫在 Acme」 | `dream/patches.jsonl` |

### Activation 預算

```
chronology/INDEX.md     必載（若有）
chronology/recent.md    必載
chronology/months/      最多 1 個月檔（後期）
years/                  僅「往年回顧」類 query
```

### node.meta.yaml 追蹤

```yaml
id: acme
centrality: high
chronology:
  recent_count: 12
  last_rolled_month: "2026-06"    # 後期
  total_primary_events: 847
```
