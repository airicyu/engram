# 0.6.0 設計審查

**對照基準：** `docs/roadmap/0.6.0/INDEX.md`（2026-09-25 初稿）

## 輪次 1（2026-09-25）

**總評：** 提案與 AGENTS／data-spec 主幹一致；活躍分只讀 vault、不經 Pi，可開工。**設計閘門通過**（無未關 HIGH）。

### Findings

| ID | 級 | 狀態 | 摘要 |
|----|-----|------|------|
| H1 | — | — | （無） |
| M1 | MEDIUM | 已收斂 | `score.yaml` 持久化：INDEX #4 定為 import-only，Lite vault 真相為 frontmatter |
| M2 | MEDIUM | 非阻擋 | 狀態燈不輪詢 future_sight 計數，僅 queue（與 Engram 簡化版一致） |

### 驗收對照

INDEX 驗收條可客觀測試（API、CSS 字串、fixture import）。

### 修復追蹤

M1 已寫入 INDEX #4；M2 記為非阻擋。
