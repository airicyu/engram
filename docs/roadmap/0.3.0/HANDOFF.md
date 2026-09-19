# HANDOFF — 0.3.0 搜尋、釐清、附圖、節點圖、工作台殼

**狀態：`planned`。** 契約以 [`INDEX.md`](./INDEX.md) 為準。設計閘門未過不要改產品碼。未出貨不要改 `version.md`。

**Do not commit unless the user asks.** 對使用者：繁體中文書面語。

## 讀檔順序

1. 根目錄 `AGENTS.md`
2. [`INDEX.md`](./INDEX.md)
3. [`docs/how.md`](./docs/how.md)、[`docs/reasoning.md`](./docs/reasoning.md)
4. 上游 [0.2.0](../0.2.0/INDEX.md)；構想 [image-attachments.md](../backlog/image-attachments.md)（勿蓋 INDEX）
5. `.agents/skills/roadmap-version/SKILL.md`（審查與 Track 實作節奏）

## 產品摘要

薄 UI 四景。Keyword 搜尋與節點圖是讀檔。釐清題由 distill skill 出、HTTP 只落答案。圖一步上傳到 vault。沉澱仍 202→skill，無 report。

## Track 順序

1. **A** 搜尋＋Ask 列表  
2. **B** 釐清  
3. **C** 附圖  
4. **D** 節點圖  
5. **E** 左欄殼  
6. **F** 契約文件（出貨才 bump version）

每軌相關測通過再進下一軌。全部結束：`bun test`。

## 禁區

- 搬 Engram dream／approve／lock／setup wizard
- Server 裡寫 chain 文體或出釐清題
- tmp 上傳、vision、HEIC、future-sight、score.yaml
- Vite／React
- 內建 cron daemon
- reset／改真人 `ENGRAM_LITE_STORE_DIR`
- git commit（除非使用者要求）

## 錨點

見 INDEX。

## 完成檢查

- [ ] 設計審查閘門通過（無未關 HIGH）
- [ ] INDEX 驗收全勾
- [ ] `bun test` 全綠
- [ ] 出貨時 `version.md`／`changelog.md`／`AGENTS.md`／data-spec／api／skills 同步
- [ ] 出貨後刪 backlog `image-attachments.md` 列

## Paste-ready starter

```text
實作 engram-lite 0.3.0。只認 docs/roadmap/0.3.0/INDEX.md 與 docs/how.md。
主幹：skills 寫 live memories；server 只讀檔、機械寫入、202 派 Pi。
Track A→B→C→D→E→F。
GET /search 機械掃 chain／nodes／pending。釐清檔 memories/clarify/{asking,pending,history}；distill 出題與吸收；HTTP 只 submit／delete／aside。
POST /attachments 一步寫正式 uploads；events 可帶精確 ![[path]] 與 attachments[]。
GET /nodes/graph 從 node wikilink 建邊。UI 仍 web/ 靜態，左欄事件／尋問／提問郵箱／記憶。
不要 dream report、approve、React、tmp、vision、future-sight、打分、內建 cron。
測試：bun test。禁止動真人 ENGRAM_LITE_STORE_DIR。不要 commit 除非我要求。
繁體中文書面語。
```
