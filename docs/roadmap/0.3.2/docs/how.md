# 0.3.2 — HOW

← [INDEX](../INDEX.md)

## 建議形狀

新增 `server/store-git.ts`（名稱可調整）：

1. `ensureStoreGit(storeDir)` — 若無 `.git` 則 `git init`；寫入／合併 `.gitignore`（必含 `jobs/` 整目錄、常見 OS 垃圾）。合併時：若缺 `jobs/` 則 append；**不**刪使用者自加條目；可將既有 `jobs/*.json` 條目升級為 `jobs/`。
2. `commitStore(storeDir, { op, id? })` — `git add -A`（尊重 gitignore）→ 若無 staged 變更則 no-op → `git commit -m "engram-lite: …"`。無開關；server 成功路徑一律呼叫。
3. 一律 sync／短 timeout；捕獲錯誤只 `console.warn`／job log。

呼叫點（成功 return 前或 job status→completed 之後）：

| 操作 | 掛鉤 |
|------|------|
| `POST /events` | append pending 成功後 |
| `POST /attachments` | 檔案落地成功後 |
| clarify submit／delete／aside | 檔案搬移／新建成功後 |
| distill job | program 兩 session **都成功**且 job 標 completed 之後 **一次** commit（不要每 session 各一次，除非 INDEX 改口） |
| reset | script 清空成功後 |

Distill：**一個成功 job = 一次 commit**（內含 distill＋clarify-generate 的檔案變更），避免半套狀態多筆碎 commit。若 job 失敗則不 commit。

## 文件

- `AGENTS.md`：對照 Engram 那段改為「Lite **有** store git：成功寫入後 local commit；仍無 dream approve」。
- `docs/data-spec.md`：短節「Store git」。
- 0.2.0／0.3.0 INDEX 非目標若仍寫「store git」→ 加註「已由 0.3.2 覆蓋」或刪除該條（實作時改，避免歷史謊言）。

## 測試

temp directory；勿碰真人 `ENGRAM_LITE_STORE_DIR`。
