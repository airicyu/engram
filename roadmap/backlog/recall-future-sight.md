# Recall 注入近程未來視（backlog）

← [backlog](./INDEX.md) · [0.4.0](../0.4.0/INDEX.md)

> **狀態：** 刻意延後。0.4.0 **不**把未來視寫進 Recall packet。

## 決定緣由

先把未來視（寫入、人審、過期痕跡 + 硬抹）做起來；是否／如何進 Recall 等用過再定，避免與寫入契約纏在一起。

## 日後可討論

- 限量未過期塊 vs 僅 `q` 指向未來時才注入
- 與 [短期未來 mindzone](./near-future-mindzone.md) 的關係（mindzone 若做，可能取代「裸注錨點」）
- 產品語彙已統一用 Recall（`GET /recall`）
