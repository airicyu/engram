# 0.3.1 HANDOFF

← [INDEX](./INDEX.md)

## 給實作 agent

1. 只認本版 `INDEX.md`＋`docs/how.md`＋`docs/reasoning.md`。  
2. 用技能 `.agents/skills/roadmap-version`：先設計審查閘門，通過後再改 skill／data-spec／測試。  
3. 可選：若本機另有 Engram 倉庫可唯讀借鏡文案；本倉庫不得把其他產品倉庫當成建置／運行時依賴。  
4. **VIP：** 例句與測試字串必須虛構；禁止真人真事。  
5. 不要 git commit，除非使用者明確要求。

## Paste-ready starter

```text
你正在實作 engram-lite 0.3.1（Chain 日記文體質感）。
只讀 docs/roadmap/0.3.1/INDEX.md、docs/how.md、docs/reasoning.md。
用 .agents/skills/roadmap-version：先設計審查，閘門通過後實作。
必改：.agents/skills/engram-lite-distill/SKILL.md（獨立「Chain 文體」小節＋虛構 Day／Week 好壞例＋zh-Hant 書面語禁令）、docs/data-spec.md 對齊同義。
借鏡唯讀：../engram/docs/roadmap/0.38.0/docs/chain-prose.md 與 server/prompts/extract.md、dream-files.md、rollup-write-week.md。
禁止：dream staging、雙檔 summary、server 文風引擎、真人隱私例句。
驗收：勾 INDEX 清單；bun test 全綠（含字串契約）。不要 commit 除非使用者要求。
```
