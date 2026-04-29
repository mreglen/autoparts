---
name: Fix Avito Sync StockOut XLSX
overview: Исправить пайплайн обработки закрытых Avito-заказов, чтобы гарантированно создавались списания, уменьшались остатки и удалялись позиции из Avito/Drom XLSX.
todos:
  - id: fix-sync-closed-processed
    content: "Изменить sync_avito_orders_for_org: нормализация статуса и условная установка closed_processed"
    status: completed
  - id: fix-closed-order-processor
    content: Сделать process_closed_avito_order результативным, добавить догрузку items и расширенный матчинг item ключей
    status: completed
  - id: fix-drom-xlsx-path
    content: Исправить путь к Drom XLSX на актуальный файл интеграции (export/saved_path)
    status: completed
  - id: improve-avito-xlsx-remove
    content: Добавить fallback удаления в Avito XLSX по альтернативному идентификатору
    status: completed
  - id: verify-e2e-flow
    content: "Проверить end-to-end sync: stock-out, уменьшение остатков, удаление из двух XLSX, отсутствие дублей"
    status: completed
isProject: false
---

# План исправления Avito→StockOut→XLSX

## Цель
После `POST /api/sales/avito-orders/sync` для закрытых заказов:
- создается `stock-out`;
- уменьшается остаток в `my-parts`;
- удаляются позиции из номенклатур Avito и Drom.

## Что исправить
- Обновить логику в [backend/app/services/avito_orders_sync.py](backend/app/services/avito_orders_sync.py):
  - нормализовать статус заказа перед проверкой (`closed` в любом регистре);
  - не ставить `closed_processed=True` безусловно;
  - ставить `closed_processed=True` только при фактической обработке хотя бы одного товара.
- Обновить [backend/app/services/avito_closed_order_processor.py](backend/app/services/avito_closed_order_processor.py):
  - возвращать структурированный результат обработки (`processed_count`, `skipped_reasons`);
  - при пустых `items` в кэше догружать детали заказа и брать `items` из детального ответа;
  - расширить извлечение идентификаторов товара (`avitoId`, `id`, `avitoItemId`, `avito_id`, fallback по `internal_code/article/partnumber`);
  - усилить логирование причин пропуска, чтобы исключить «тихие» провалы.
- Исправить удаление из Drom XLSX:
  - в [backend/app/services/avito_closed_order_processor.py](backend/app/services/avito_closed_order_processor.py) использовать корректный путь/имя файла (`export.xlsx` или `saved_path` из кэша интеграции), а не жестко `autoload.xlsx`.
- Усилить удаление из Avito XLSX в [backend/app/services/avito_autoload_xlsx.py](backend/app/services/avito_autoload_xlsx.py):
  - добавить fallback-удаление по дополнительным колонкам идентификатора (например, `AvitoId`), если удаление по `Id=internal_code` не нашло строку.

## Проверка
- Ручной прогон `POST /api/sales/avito-orders/sync` на закрытом заказе:
  - есть новая запись в `stock_out`;
  - количество у соответствующего товара уменьшено;
  - строка удалена из Avito и Drom XLSX.
- Повторный sync не должен создавать дубль для того же закрытого заказа.
- Логи должны показывать: сколько товаров обработано, сколько пропущено и почему.

## Поток после правок
```mermaid
flowchart TD
syncEndpoint[SyncEndpoint] --> fetchOrders[FetchOrders]
fetchOrders --> normalizeStatus[NormalizeStatus]
normalizeStatus --> closedCheck{StatusClosed}
closedCheck -->|yes| processOrder[ProcessClosedOrder]
closedCheck -->|no| skipOrder[SkipOrder]
processOrder --> resolveItems[ResolveItemsFromCacheOrDetail]
resolveItems --> matchProducts[MatchProducts]
matchProducts --> createStockOut[CreateStockOutAndDecreaseQty]
createStockOut --> removeAvitoXlsx[RemoveFromAvitoXlsx]
createStockOut --> removeDromXlsx[RemoveFromDromXlsx]
removeAvitoXlsx --> markProcessed[MarkClosedProcessedIfProcessedCountGT0]
removeDromXlsx --> markProcessed
markProcessed --> commitTx[Commit]
```
