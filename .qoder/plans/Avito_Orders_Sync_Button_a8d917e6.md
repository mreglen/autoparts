# Автоматическая обработка closed заказов при нажатии "Обновить"

## Цель
При нажатии кнопки "Обновить" в /sales/orders:
1. Синхронизировать ВСЕ заказы Авито из API
2. Обновить статусы заказов в БД
3. Проверить все заказы со статусом `closed` и обработать те, которые еще не были обработаны
4. Это служит страховкой на случай, если автоматическая обработка не сработала во время обычной синхронизации

## Текущее состояние

### Файлы синхронизации:
- **`backend/app/services/avito_orders_sync.py`** - функция `sync_avito_orders_for_org()` уже:
  - Загружает все заказы из API Авито
  - Создает новые записи в `AvitoOrderCache`
  - Обновляет статусы существующих записей
  - Обрабатывает заказы, у которых статус ИЗМЕНИЛСЯ на `closed` (строки 170-172)

- **`backend/app/routers/sales.py`** - endpoint `POST /sales/avito-orders/sync` (строки 159-171) вызывает синхронизацию

- **`frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx`**:
  - Кнопка "Обновить" (строка 305-307) вызывает `fetchAll()`
  - `fetchAll()` (строка 96-143) уже вызывает синхронизацию в строке 103: `await apiAxios.post('/sales/avito-orders/sync').catch(() => {});`

### Проблема:
Текущая логика в `avito_orders_sync.py` обрабатывает closed заказы ТОЛЬКО если статус ИЗМЕНИЛСЯ на closed:
```python
if new_status == "closed" and old_status != "closed":
    closed_orders_to_process.append(row)
```

Это означает, что если:
- Заказ уже был в статусе `closed` в БД
- Обработка не сработала ранее (ошибка, сбой и т.д.)
- При следующей синхронизации заказ НЕ будет обработан, т.к. `old_status == "closed"`

## Решение

### Задача 1: Добавить поле `closed_processed` в модель AvitoOrderCache

**Файл**: `backend/app/models/avito_orders_cache.py`

Добавить новое поле для отслеживания обработки закрытого заказа:
```python
closed_processed = Column(Boolean, nullable=False, server_default="false", default=False)
```

Это поле будет:
- `false` - заказ со статусом `closed` еще не обработан
- `true` - заказ уже обработан (stock-out создан, количество уменьшено и т.д.)

**Файл**: Создать SQL миграцию

Создать файл `backend/migrations/add_closed_processed_to_avito_orders.sql`:
```sql
ALTER TABLE avito_orders_cache 
ADD COLUMN IF NOT EXISTS closed_processed BOOLEAN NOT NULL DEFAULT false;
```

### Задача 2: Обновить логику синхронизации для обработки ВСЕХ необработанных closed заказов

**Файл**: `backend/app/services/avito_orders_sync.py`

Изменить логику после обновления заказов (после строки 172):

**Текущий код** (строки 170-172):
```python
# Проверяем, стал ли заказ закрытым (изменение статуса на closed)
if new_status == "closed" and old_status != "closed":
    closed_orders_to_process.append(row)
```

**Новый код**:
```python
# Проверяем, стал ли заказ закрытым (изменение статуса на closed)
if new_status == "closed":
    # Обрабатываем если:
    # 1. Статус только что изменился на closed (old_status != "closed")
    # 2. ИЛИ заказ уже был closed но еще не обработан (not row.closed_processed)
    if old_status != "closed" or not row.closed_processed:
        closed_orders_to_process.append(row)
```

Также добавить обработку для УЖЕ СУЩЕСТВУЮЩИХ closed заказов в БД, которые не были обработаны:

**После основного цикла** (перед `db.commit()` на строке 174), добавить запрос для поиска необработанных closed заказов:

```python
# Находим все закрытые заказы, которые еще не были обработаны
# (страховка на случай если обработка не сработала ранее)
unprocessed_closed_orders = (
    db.query(AvitoOrderCache)
    .filter(
        AvitoOrderCache.organization_id == organization_id,
        AvitoOrderCache.avito_status_code == "closed",
        AvitoOrderCache.closed_processed == False
    )
    .all()
)

# Добавляем их в список для обработки, избегая дубликатов
existing_ids = {order.id for order in closed_orders_to_process}
for order in unprocessed_closed_orders:
    if order.id not in existing_ids:
        closed_orders_to_process.append(order)
        logger.info(f"Found unprocessed closed order {order.id} (avito_order_id={order.avito_order_id})")
```

### Задача 3: Отметить заказ как обработанный после успешной обработки

**Файл**: `backend/app/services/avito_orders_sync.py`

В блоке обработки закрытых заказов (строки 177-191), после успешной обработки установить флаг:

**Текущий код** (строки 180-184):
```python
try:
    # Импортируем здесь, чтобы избежать циклических зависимостей
    from app.services.avito_closed_order_processor import process_closed_avito_order
    await process_closed_avito_order(db, order)
    db.commit()  # Коммитим изменения после обработки каждого заказа
```

**Новый код**:
```python
try:
    # Импортируем здесь, чтобы избежать циклических зависимостей
    from app.services.avito_closed_order_processor import process_closed_avito_order
    await process_closed_avito_order(db, order)
    
    # Отмечаем заказ как обработанный
    order.closed_processed = True
    db.commit()  # Коммитим изменения после обработки каждого заказа
    
    logger.info(f"Successfully processed closed Avito order {order.id}")
```

### Задача 4: Обновить процессор closed заказов (опционально, для идемпотентности)

**Файл**: `backend/app/services/avito_closed_order_processor.py`

В начале функции `process_closed_avito_order()` добавить проверку (строка 33):

```python
async def process_closed_avito_order(db: Session, order: AvitoOrderCache) -> None:
    """
    Обработать закрытый заказ Авито.
    Идемпотентная функция - можно вызывать многократно.
    """
    # Проверяем, не был ли заказ уже обработан
    if order.closed_processed:
        logger.info(f"Avito order {order.id} already processed, skipping")
        return
    
    order_id = order.id
    # ... остальной код
```

Это обеспечит дополнительную защиту от повторной обработки.

### Задача 5: Проверка frontend (без изменений)

**Файл**: `frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx`

Текущая реализация уже корректна:
- Строка 103: `await apiAxios.post('/sales/avito-orders/sync').catch(() => {});`
- Синхронизация вызывается при каждом нажатии "Обновить"
- Ошибки игнорируются (`.catch(() => {})`), чтобы продолжить загрузку данных из кэша

**Изменения не требуются**.

## Порядок выполнения

1. Создать SQL миграцию для добавления поля `closed_processed`
2. Добавить поле `closed_processed` в модель `AvitoOrderCache`
3. Обновить логику в `avito_orders_sync.py`:
   - Изменить условие добавления в `closed_orders_to_process`
   - Добавить поиск существующих необработанных closed заказов
   - Установить `closed_processed = True` после обработки
4. Добавить проверку `closed_processed` в `avito_closed_order_processor.py`
5. Протестировать:
   - Синхронизация новых заказов
   - Обработка заказов при изменении статуса на closed
   - Повторная обработка ранее необработанных closed заказов
   - Идемпотентность (повторный вызов не создает дубликаты)

## Важные замечания

1. **Идемпотентность**: Функция `process_closed_avito_order()` уже имеет защиту от повторной обработки через проверку stock-out записей, но добавление флага `closed_processed` делает это более явным и эффективным

2. **Обратная совместимость**: Поле `closed_processed` имеет значение по умолчанию `false`, поэтому все существующие closed заказы будут считаться необработанными и будут обработаны при следующей синхронизации

3. **Логирование**: Добавить информативные логи для отслеживания:
   - Сколько заказов найдено как необработанные
   - Сколько заказов успешно обработано
   - Ошибки обработки с деталями

4. **Транзакции**: Все операции с заказом выполняются в одной транзакции (включая установку флага `closed_processed`)

5. **Производительность**: Запрос необработанных closed заказов выполняется один раз за синхронизацию и затрагивает только организацию пользователя
