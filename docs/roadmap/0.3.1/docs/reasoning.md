# 0.3.1 — WHY

← [INDEX](../INDEX.md)

## 問題

完整 Engram 的 chain 文風經多輪調校（含 0.38 文章化）後，日／週敘事接近自然日記。engram-lite 在 data-spec／distill skill **已抄到結構契約**，但實測質感仍偏生硬——常見缺口是：缺好壞例、書面語禁令不夠硬、文體指示埋在作業步驟中被模型略過。

## 為何只動 skill／契約文

- Lite 架構警世：語意判斷留在 skill；program 不做文風規則引擎。  
- 結構已對齊；再造目錄或雙檔 chain 成本高、與「同一功能、更輕」相反。  
- 好壞例＋硬禁令是 Engram 調校裡**最便宜、對齊效應最大**的可搬部分。

## 否決方案

| 方案 | 為何否決 |
|------|----------|
| 整份搬入 Engram `dream-files`／extract 當 lite runtime | 綁 draft／approve／雙檔；過重 |
| Server 對 summary 做文風 lint 硬 fail | 把判斷塞進 program；誤殺合法碎句 |
| 重寫 UI 或換模型當「修文風」 | 不解決契約不清 |
| 把真人日記貼進 roadmap／測試當金標 | 違反 VIP：測試／demo 嚴禁真人真事 |

## 失敗模式

- 只加形容詞（「寫自然一點」）無好壞例 → 質感不變。  
- 與 0.3.0 同改 distill skill 時覆蓋「不寫 asking」→ 回歸釐清空窗。  
- 例句用真人私事 → 隱私事故。
