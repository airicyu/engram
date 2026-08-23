# 0.43 reasoning

← [INDEX](../INDEX.md)。做什麼以 INDEX／how 為準。改已定案前須能回答：下列失敗模式是否仍成立。

## 為何刪 `runs/*.yaml`（不再 0.21 永久留）

0.21 留 yaml 是為審計與 `l1_clear_pending` 恢復。後者仍成立，故 **A3** 對 `l1_clear_pending` 跳過 TTL。審計：L2 已在 store git；staging yaml 堆幾個月對工作台沒有產品價值。若再留 yaml 卻刪 report，目錄會永遠長、也對不齊「跟 reports 同節奏」。

否決：另設 90 天 yaml TTL——兩套時鐘難解釋、必漂。

## 為何問答不放 `ENGRAM_TEMP_DIR` 當 24h 真相

Ask job 已在 `/tmp`；OS 清 tmp、重開機、`KEEP_JOBS=5` 都會讓「暫留一天」破功。產品句是人在尋問點回昨天的題，不是除錯暫存。故寫入本就不進 git 的 `dreams/ask-history/`，跟庫走、跟 `dreams/reports` 一樣可被本機刪庫清掉，但不會被 tmpwatch 誤殺。

否決：只改 `KEEP_JOBS` 為極大——仍在 tmp，壽命不可控。

## 為何 failed／cancelled 也入列

只留 completed 時，人會以為「問過但失敗的題蒸發了」。列表有 status 即可，點開看 error，不必重跑才知道失敗。
