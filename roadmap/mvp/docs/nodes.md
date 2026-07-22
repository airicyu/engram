# Nodes（語意網絡）

← [INDEX](../INDEX.md) · [chronology](./nodes-chronology.md) · [graph / 重組](./nodes-graph.md)

brain 內有不同 **記憶節點**（不限於「context」）：

```
nodes/
├── acme/                       # 組織
├── alice/                     # 人
├── aurora/                      # 主題
└── api-integrations/       # 也可以是節點；將來或有 kind 區分
```

## 目錄結構

```
nodes/{id}/
├── node.meta.yaml             # kind, aliases, created_at, centrality
├── INDEX.md                   # 精簡投影（衍生，有行數上限，會 spillover）
├── understand/                # 語意記憶
│   ├── what.md                # MVP 必做
│   ├── who.md                 # 後期
│   ├── why.md
│   ├── favor.md               # 偏好、價值觀、重視什麼
│   ├── problems.md            # 痛點、現存問題、缺口
│   ├── when.md
│   ├── how.md
│   └── open.md                # 尚未釐清的理解
├── chronology/                # 情節痕跡 → nodes-chronology.md
│   ├── INDEX.md
│   ├── recent.md              # MVP
│   ├── months/                # 後期
│   └── years/
└── links.md
```

**新建 node：** Dream 只寫 `candidates/nodes.yaml`，人批准後才建上列骨架。見 [nodes-graph.md](./nodes-graph.md)。

## 核心理解（語意 facets）

從 **What** 引伸：定義 → scoping → boundary → unclear boundary（`open.md`）。

| Facet | 檔案 | 回答什麼 | MVP |
|-------|------|----------|-----|
| **What** | `what.md` | 是什麼、定義、scope、**已確定**的邊界 | ✓ |
| **Who** | `who.md` | stakeholder 是誰 | 後期 |
| **Why** | `why.md` | 為什麼存在、動機、**價值主張** | 後期 |
| **Favor** | `favor.md` | **偏好與價值觀** | 後期 |
| **Problems** | `problems.md` | **現存痛點** — pain / lack / problem | 後期 |
| **When** | `when.md` | 關鍵時間點（非 daily log） | 後期 |
| **How** | `how.md` | 已定義做法、約束、選型 | 後期 |
| **Open** | `open.md` | **尚未釐清**的假設、模糊邊界 | 後期 |

### 邊界（是／不是）

| Facet | 是 | 不是 |
|-------|----|------|
| `open.md` | 對該 node **尚未釐清的理解** | 待辦清單 / 專案 task |
| `problems.md` | **現存痛點的語意陳述** | 工單追蹤 / timeline |
| 全體 understand | 「現在怎麼理解這個 node」 | 前瞻「我要做什麼」 |

### Favor vs Problems vs Why

| | Favor | Problems | Why |
|---|-------|----------|-----|
| 問法 | 「偏好什麼／重視什麼？」 | 「哪裡痛／缺什麼？」 | 「為何要做／為何重要？」 |
| 性質 | 價值觀、傾向 | **現狀**的摩擦、缺口 | 動機、存在意義 |

### Open

已確定 → `what.md` 等；未確定 → `open.md`。釐清後 `resolve_open` 移入對應 facet。

---

## Understand：可改寫 + 可追溯（已定案）

> Facet 檔可被 revise；**每次 revise 必須帶 `event_refs` + `patch_id`。不靜默覆寫。**

```markdown
## Current
（Activation 只讀這段）

## History
### 2026-07-18 · patch:p042 · events:[e041,e042]
（被 supersede 的舊段落，或一行摘要）
```

| 衝突策略（MVP） | |
|-----------------|--|
| 新 revise | 寫入 **Current** |
| 舊 Current | 移入 **History**（附 patch / event_refs） |
| 不做 | 自動辯論式 merge |

**手改：** 允許直接改 Current（或整檔）。下次 Dream 把「手改後的 Current」當先驗，與 L1 同化（append / revise / open）——與「新事件推翻舊夢」同一路徑。

L2 = 當前表面；L1.5 = Dream 決策 audit；L0 = 情節原稿。

---

## INDEX.md（節點意識投影）

類似 CLAUDE.md：

- 極簡核心描述
- details 指向 `understand/`、chronology、links
- 重要事件只寫一句 + link
- **內容少** → inline；**內容多** → spill 到外部檔
- **衍生資料**：可從 understand + chronology 重建
- MVP 可極簡或暫手寫；spillover / budget 後期

## Node kind

```yaml
kind: org | person | theme | thing | place | ...
```

`kind` 幫助做夢時選預設 facet；**不**觸發 workflow。

建立與重組 → [nodes-graph.md](./nodes-graph.md)
