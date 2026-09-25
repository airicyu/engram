# 0.3.2 HANDOFF

← [INDEX](./INDEX.md)

## 給實作 agent

1. 只認本版 INDEX＋docs/how.md＋docs/reasoning.md。  
2. 用 `.agents/skills/roadmap-version`：先設計審查，再實作。  
3. **VIP：** 測試用 temp／虛構；禁止真人記憶庫；commit message 禁止正文。  
4. 本倉庫自立：不依賴 Engram 程式或 vibe-* 倉庫。  
5. 不要 commit **程式倉**，除非使用者要求。

## Paste-ready

```text
實作 engram-lite 0.3.2（Store git：每次成功改 vault 就 local commit）。
讀 docs/roadmap/0.3.2/INDEX.md、docs/how.md、docs/reasoning.md。
用 .agents/skills/roadmap-version：先設計審查閘門，通過後實作。
做 server/store-git.ts（或等價）：ensureRepo＋commitOp；gitignore 排除 jobs/；掛在 events／attachments／clarify／distill completed／reset 成功路徑。
distill：一 job 成功一次 commit。git 失敗只 log、不回滾、不改已成功 HTTP。
更新 AGENTS.md、data-spec；bun test 用 temp store。禁止 push／approve／dream staging／真人 fixture。
不要 git commit 程式倉除非使用者要求。
```
