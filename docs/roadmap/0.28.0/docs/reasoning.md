# Reasoning — 為何 0.28 這樣定

← [INDEX](../INDEX.md)

## 1. 為何現在做路徑重構

0.25–0.27 把「理解長什麼樣」與「審稿怎麼修」收斂了，但磁碟仍是早期多 facet 殘留：`understand/what.md`。後果：

- Obsidian／短 wikilink **全面撞名**（每個 node 都叫 `what`）。
- Stub `INDEX.md` 與真正正文分裂，vault 裡「打開 node」體驗差。
- 要長 node↔node 邊時，無法用自然的 `[[mak]]`。

附圖、graph UI 都仰賴「vault＝memories＋可點連結」。先改主檔，後做 media／graph 才不會雙重 migrate。

## 2. 為何是 `{id}/{id}.md` 而不是 `index.md`

| 方案 | 否決／採納理由 |
|------|----------------|
| 保留 `understand/what.md` | 撞名；巢狀無收益（understand 下只有一檔） |
| `{id}/index.md` | 全庫 basename＝`index`，短連仍廢；alias 不能當可靠 destination |
| `{id}/index.md`＋alias＝id | UI 選 alias 常寫成 `[[…/index\|id]]`；手打／跨工具仍脆 |
| **`{id}/{id}.md`** | basename＝node id（庫內唯一）⇒ `[[mak]]` 可用；folder-note 常見慣例；關聯目標單一 |

API 鍵保持 `understanding`：語意是「理解正文」，不是檔名 what。

## 3. 為何 vault＝`memories/` 而不是 store 根

- `dreams/` 是 draft／report 暫存與人審工作區，**不是**長期閱讀真相。
- 人用 Obsidian 應對齊 git 已追蹤的 `memories/**`。
- md 內 link 前綴更短：`nodes/…`、`_attachments/…`。

Server／draft 鏡像仍用 store-relative `memories/...`（程式與安全邊界不變）。只有「寫進 md、給 Obsidian 看」的連結用 vault-relative。

## 4. 為何 migrate 不重寫正文連結

- 舊庫 Relation 多為散文，自動 NER→wikilink 易誤連、難驗收。
- 結構 hop 應 **機械、可腳本、可回滾備份**；內容漂移留給後續 dream（0.25 懶改寫精神）。
- 本版把「正確寫法」變成之後每一輪的生長規則即可。

## 5. 為何圍護採分層、預設不硬拒 approve

0.25 已否決「缺小標就 4xx」：半寫 draft、舊資料、agent 偶發漏標題會卡死 Consolidate。  
0.28 維持 **P3 不硬拒、P4 死連只警告**；用 **P2 Structure notes** 讓人看得到，再配 amend。

## 5b. 為何 migrate 清空 pending（P5）

若 boot 因未 migrate 拒啟，又要求「先 API discard」→ 死結。  
改 draft path 保留 pending 可行，但結構代已變，未審稿常與新白名單／骨架／wikilink 規則不合，轉換成本高、審起來也怪。

故本版：**備份後離線丟棄 pending**（刪 draft、標 discarded），只機械遷 live。簡單、無死結、升級後狀態乾淨。使用者若需保留內容，應在升級**前**用舊版 binary 先 approve（或接受備份裡還有舊 draft）。

## 6. 與附圖／graph 的邊界

- `_attachments` 空目錄＝佔位與文件對齊；上傳 API 另版，避免本版 scope 爆炸。
- Typed `links.yaml`／內建 graph GUI 另版；本版先讓 **md 邊** 存在，Obsidian graph 與未來掃邊才有原料。

## 7. 參考（研究；非實作真相）

對話／research-notes 中的定案已吸入 INDEX 與本版 docs。實作 agent **只須讀本版 roadmap**；research-notes 為史料。
