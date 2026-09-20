# 0.3.1 — HOW

← [INDEX](../INDEX.md)

## 目標行為（實作 agent 完成後應如此）

1. 跑 distill 寫 day／week／month／year 時，模型在 skill 裡一眼能看到**獨立文體契約**，不必從長步驟裡自行拼湊。
2. `zh-Hant` 輸出為繁體**書面語**日記，不是口語或報告條列。
3. 多線日子有多個 `##`；週記是取捨後的回顧，不是七天合訂本。

## 改檔清單（預期）

| 檔 | 動作 |
|----|------|
| `.agents/skills/engram-lite-distill/SKILL.md` | **必改**：新增或抽離「Chain 文體」獨立小節；移入／寫明 INDEX 已定案 #3；加入虛構 Day／Week 好壞例 |
| `docs/data-spec.md` | **必對齊**：Memory chain「分題材、寫成文」與 skill 同義；補書面語禁令若仍弱 |
| `server/**/*.test.ts` 或既有 skills 測試 | **必加**：字串契約（獨立小節標題、書面語／禁粵語或等價句、好例／壞例標題存在） |
| `docs/architecture/chain-prose.md` | 可選短文，只做索引 |

## 從 Engram 借什麼（語意，不要整檔複製進 runtime）

可選借鏡（非依賴；無 Engram 亦可只依本版 INDEX／HOW 完成）：

1. **0.38 `chain-prose.md` §2–§4、§6** — 海拔表、標題／段落規則、Day／Week 好壞例結構。  
2. **`extract.md` chain.summary 義務** — 不同生命線 → 不同 `##`；禁止焊牆；完整句子。  
3. **`dream-files.md` Day summary shape** — readable narrative；Fragmentary OK；禁固定 Work／Family checklist。  
4. **`rollup-write-week.md` Purpose／Selection** — centres of gravity；anthology = failure。

Lite 路徑與 Engram 不同（lite 每層單檔、無 `*.summary.md` 雙檔）——**只借文風與取捨，不借檔名與 draft 管線**。

## 寫進 skill 的例句約束

- 一律虛構。  
- 可沿用 0.38 捏造世界的寫法（體檢／晚飯／發版分題），但改名以免像文件複製。  
- 壞例展示：併題、逗號牆、週合訂本。  
- 好例展示：分 `##`、一段一拍、週取捨。

## 驗收對照

做完後逐條勾 INDEX 驗收；字串測失敗＝未完成。
