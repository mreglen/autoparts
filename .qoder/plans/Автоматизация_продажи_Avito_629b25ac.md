# Автоматизация обработки закрытых заказов Авито

## Цель
При синхронизации с Авито, когда заказ получает статус `closed`, автоматически:
1. Создать запись в stock-out (расходы) для каждого товара в заказе
2. Уменьшить количество товара в /my-parts
3. Удалить товар из Avito номенклатуры (xlsx файл автозагрузки)
4. Удалить товар из Drom номенклатуры (xlsx файл автозагрузки)
5. В расходах отображать пометку "Продано через Авито"

## Архитектура решения

### Ключевые файлы для модификации:
- **Backend**:
  - `backend/app/services/avito_orders_sync.py` - логика синхронизации заказов Авито
  - `backend/app/routers/stock_outs.py` - создание записей stock-out
  - `backend/app/routers/avito_integration.py` - работа с Avito xlsx файлами
  - `backend/app/routers/drom_integration.py` - работа с Drom xlsx файлами
  - `backend/app/schemas/stock_out.py` - схема stock-out
  - `backend/app/models/stock_out.py` - модель stock-out (возможно добавить поле sale_channel)

- **Frontend**:
  - `frontend/my-autoparts/src/pages/StockOut/StockOutList.jsx` - отображение продаж
  - `frontend/my-autoparts/src/pages/StockOut/StockOutRow.jsx` - строка расхода

## Задача 1: Добавить поле sale_channel в модель StockOut

**Файл**: `backend/app/models/stock_out.py`

Добавить новое поле для отслеживания канала продажи:
```python
sale_channel = Column(String(50), nullable=True)  # 'avito', 'drom', 'warehouse', etc.
avito_order_id = Column(String(64), nullable=True)  # ID заказа Авито для связи
```

**Файл**: `backend/app/schemas/stock_out.py`

Добавить поля в схемы `StockOutCreate` и `StockOut`:
```python
sale_channel: Optional[str] = None
avito_order_id: Optional[str] = None
```

Создать SQL миграцию для добавления новых колонок в таблицу `stock_out`.

## Задача 2: Создать сервис для обработки закрытых заказов Авито

**Новый файл**: `backend/app/services/avito_closed_order_processor.py`

Создать сервис `process_closed_avito_order()`, который:

1. **Извлекает товары из заказа**:
   ```python
   avito_data = order.avito_data or {}
   items = avito_data.get("items") or avito_data.get("products") or []
   ```

2. **Для каждого товара в заказе**:
   - Извлечь `avito_ad_id` (internal_code) из item
   - Найти `ProductAvitoListingLink` по `avito_ad_id` и `organization_id`
   - Получить связанный `Product`
   - Проверить, что `product.quantity >= item.quantity`
   
3. **Создать запись StockOut**:
   ```python
   stock_out = StockOut(
       organization_id=order.organization_id,
       product_id=product.id,
       quantity=item_quantity,
       sale_price=item_price,  # из items заказа
       movement_date=date.today(),
       user_id=None,  # или system user
       reason="Продано через Авито",
       sale_channel="avito",
       avito_order_id=order.avito_order_id,
       storage_location_id=product.storage_location_id
   )
   ```

4. **Уменьшить количество товара**:
   ```python
   product.quantity -= item_quantity
   ```

5. **Удалить из Avito xlsx номенклатуры**:
   - Загрузить файл `uploads/avito/{org_id}/autoload.xlsx`
   - Использовать логику из `avito_autoload_xlsx.py` для удаления строки по `internal_code`
   - Сохранить обновлённый файл
   - Обновить кеш в `OrganizationAvitoAutoloadCache`

6. **Удалить из Drom xlsx номенклатуры**:
   - Загрузить файл `uploads/drom/{org_id}/autoload.xlsx`
   - Использовать логику из `drom_autoload_xlsx.py` для удаления строки по `article`
   - Сохранить обновлённый файл
   - Обновить кеш в `OrganizationDromAutoloadCache`

7. **Удалить связи listing**:
   ```python
   db.query(ProductAvitoListingLink).filter_by(
       organization_id=org_id, 
       product_id=product.id
   ).delete()
   
   db.query(ProductDromListingLink).filter_by(
       organization_id=org_id, 
       product_id=product.id
   ).delete()
   ```

## Задача 3: Интегрировать обработку в синхронизацию Авито

**Файл**: `backend/app/services/avito_orders_sync.py`

В функции `sync_avito_orders_for_org()`, после обновления статуса заказа:

```python
# После строки 140 (обновление статуса)
new_status = str(status_code) if status_code is not None else None

# Проверяем, стал ли заказ закрытым
if row and new_status == "closed" and row.avito_status_code != "closed":
    # Заказ только что получил статус closed
    from app.services.avito_closed_order_processor import process_closed_avito_order
    try:
        await process_closed_avito_order(db, row)
    except Exception as e:
        logger.error(f"Error processing closed Avito order {row.id}: {e}")
        # Не прерываем синхронизацию из-за ошибки обработки
```

**Важно**: Проверять, что статус изменился именно на `closed` (чтобы не обрабатывать повторно).

## Задача 4: Обновить отображение в StockOut

**Файл**: `backend/app/routers/stock_outs.py`

В endpoint `get_warehouse_sales()` добавить информацию о канале продажи в ответ.

**Файл**: `frontend/my-autoparts/src/pages/StockOut/StockOutRow.jsx`

В отображении добавить индикатор канала продажи:
```jsx
{item.sale_channel === 'avito' && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
    Продано через Авито
  </span>
)}
```

**Файл**: `frontend/my-autoparts/src/pages/StockOut/StockOutList.jsx`

Добавить фильтр по каналу продажи (опционально) и обновить отображение десктоп/мобильной версии.

## Задача 5: Создать функцию удаления товара из xlsx файлов

**Файл**: `backend/app/services/avito_autoload_xlsx.py`

Добавить функцию `remove_product_from_avito_autoload()`:
```python
def remove_product_from_avito_autoload(
    existing_xlsx: bytes,
    internal_code: str,
) -> bytes:
    """Удалить товар из Avito xlsx по internal_code"""
    wb = load_workbook(BytesIO(existing_xlsx), read_only=False)
    
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        # Найти строку по internal_code в колонке AvitoItemId
        # Удалить строку
        # Сдвинуть остальные строки вверх
    
    # Вернуть обновлённый xlsx
    output = BytesIO()
    wb.save(output)
    return output.getvalue()
```

**Файл**: `backend/app/services/drom_autoload_xlsx.py`

Аналогичная функция `remove_product_from_drom_autoload()`:
```python
def remove_product_from_drom_autoload(
    existing_xlsx: bytes,
    article: str,
) -> bytes:
    """Удалить товар из Drom xlsx по article"""
```

## Задача 6: Тестирование и проверка

1. Проверить, что при синхронизации с Авито заказы со статусом `closed` обрабатываются корректно
2. Убедиться, что stock-out записи создаются с правильными данными
3. Проверить, что количество товара уменьшается
4. Проверить, что товар удаляется из Avito и Drom xlsx файлов
5. Проверить отображение в /stock-out с пометкой "Продано через Авито"
6. Проверить, что в /my-parts товар больше не отображается (если quantity=0)
7. Проверить, что в /settings/integration/avito/nomenclature и /drom/nomenclature товар удалён

## Важные замечания

1. **Идемпотентность**: Обработка должна быть идемпотентной - если заказ уже обработан, не обрабатывать повторно
   - Можно добавить поле `avito_order_processed` в `AvitoOrderCache`
   - Или проверять существование stock-out записи с `avito_order_id`

2. **Транзакции**: Все операции должны выполняться в одной транзакции БД для консистентности

3. **Ошибки**: Если товар не найден или недостаточно количества, логировать ошибку, но не прерывать синхронизацию

4. **Файлы xlsx**: Если xlsx файл не существует, пропускать удаление из номенклатуры и логировать предупреждение

5. **Хранение файлов**: После удаления товара из xlsx обновлять кеш в БД (`OrganizationAvitoAutoloadCache` и `OrganizationDromAutoloadCache`)

6. **Миграция БД**: Необходимо создать SQL миграцию для добавления новых полей в таблицу `stock_out`

## Порядок выполнения

1. Создать миграцию БД для новых полей в stock_out
2. Обновить модели и схемы StockOut
3. Создать функции удаления из xlsx файлов
4. Создать сервис process_closed_avito_order
5. Интегрировать в синхронизацию Авито
6. Обновить frontend для отображения канала продажи
7. Протестировать весь workflow