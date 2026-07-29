# Store 以 local git 做 apply 事務（backlog）

← [backlog](./INDEX.md) · **已併入 [0.16.0](../0.16.0/INDEX.md)（shipped）**

> **狀態：** **done／shipped in 0.16.0**。下列「舊構想」有多處被 0.16 定案 **supersede**——實作真相以 0.16 INDEX／docs 為準，勿按本檔舊步驟做。

## 動機（仍成立）

Approve 需要機械可復原的事務與歷史；bak 回滾跨行程不保證。

## 0.16 定案如何對齊／推翻本檔

| 本檔舊構想 | 0.16 |
|------------|------|
| 直接改 live working tree | **否**——仍先 draft，approve 才 deploy |
| 人審看 git diff | **否**——人審看固定結構 report；git 管 deploy 後歷史與回滾 |
| 取消 draft | **否**——保留 draft |
| 失敗 `git reset` | **只還原 touched paths**；禁止整庫 `reset --hard` |
| `ENGRAM_HOME` | 現名 **`ENGRAM_STORE_DIR`** |

細節見 [0.16.0 INDEX](../0.16.0/INDEX.md) 與 `docs/reasoning.md`。

## 非目標（仍成立）

- 不是把記憶推上 GitHub／遠端當同步方案
- 不是取代 L0 唯附加語意
