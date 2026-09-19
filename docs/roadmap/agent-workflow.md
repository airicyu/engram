# Roadmap 開發節奏（engram-lite）

← [GUIDELINES.md](./GUIDELINES.md)（寫什麼）· [AGENTS.md](../../AGENTS.md)

[`GUIDELINES.md`](./GUIDELINES.md) 管文件自足；本檔管 **誰開 session、何時審查、何時出貨**。節奏對齊完整 Engram 的 `agent-workflow.md`，按 Lite 規模縮短。

---

## 建議生命周期（中改以上）

```text
構想／backlog
    → 排程 INDEX（planned）
    → 寫滿已定案／需要時 docs／reasoning
    → 【可選】新 agent：design-review
    → HANDOFF.md（含 paste-ready starter）
    → 新 agent 實作（in progress）
    → 【建議】implementation-review
    → shipped：version.md／changelog.md／契約；勾驗收；清 backlog
```

小改可縮成：自足 INDEX → 實作 → 對照驗收。

不要讓同一個長對話既腦暴、又實作、又自審。實作 agent **只認檔案、不認聊天**。

---

## 角色

| 角色 | 產物 | 不要做 |
|------|------|--------|
| 規劃 | INDEX、docs、reasoning | 大範圍實作（除非使用者明確要求） |
| 設計審查 | `docs/design-review.md` | 直接改程式；擅自改已定案 |
| 實作 | 程式＋測試 | 發明 INDEX 未寫的語意；做非目標 |
| 實作審查 | `docs/implementation-review.md` | 順便加功能 |

出貨門檻：無未關閉 HIGH；驗收全勾；`bun test` 全綠；`version.md` 已改。**不要 git commit，除非使用者明確要求。**

---

## 本專案測試

```bash
cd engram-lite
bun test
```

禁止 `rm` 使用者真實 `ENGRAM_LITE_STORE_DIR`。Demo 庫可改；不要把真人 pending 提交進 git。
