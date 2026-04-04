# Откуда берутся данные по коробке передач (TecDoc)

В проекте **нет** отдельной ORM-модели «коробка передач» в [`app/models/tecdoc.py`](app/models/tecdoc.py) (в отличие от производителей, моделей, двигателей и passengercar). Список вариантов КПП для выбора в UI строится **запросом к сырой таблице атрибутов TecDoc**.

## API

- **Маршрут:** `GET /api/vehicle-catalog/passengercars/{passengercar_id}/transmissions`
- **Реализация:** [`app/routers/vehicle_catalog.py`](../app/routers/vehicle_catalog.py) — функция `list_transmissions_for_passengercar`.
- **Ответ:** список объектов [`TecdocTransmissionOut`](../app/schemas/vehicle_catalog.py): поля `title` и `value` (из колонок `DisplayTitle` и `DisplayValue`).

## Таблица в базе

- **`tecdoc_items_atributes`** — атрибуты/характеристики позиций каталога (в т.ч. тип КПП и связанные подписи).

## Логика SQL

В том же файле задан константный запрос `_TRANSMISSION_SQL`:

1. Выбираются **уникальные** пары `DisplayTitle` → `title`, `DisplayValue` → `val`.
2. Фильтр по связям с поколением (passengercar):
   - в выборку попадают строки, где `item_id` **или** `"ParentLinkitem"` входят в набор id:
     - `passengercar_id` (id поколения в `tecdoc_passengercars`);
     - при наличии — `InternalID` и `Model` этой же строки поколения.
3. Исключаются пустые `DisplayValue`.
4. Остаются только строки, у которых по смыслу «про трансмиссию» — по подстрокам (без учёта регистра) в полях:
   - `AttributeGroup`, `AttributeType`, `DisplayTitle`, `DisplayValue`, `LinkitemType`  
   на ключевые слова вроде `trans`, `gear`, `getrieb`, «короб», «кпп», `akpp`, `мкпп`, `вариатор`, `cvt`, `dsg` и т.д.

То есть КПП в каталоге — это **не отдельная сущность**, а **отфильтрованные атрибуты** из `tecdoc_items_atributes`, привязанные к id поколения/модели.

## Как это сохраняется в «ваших» таблицах приложения

В таблице **`vehicles`**:

| Поле | Смысл |
|------|--------|
| `transmission` | Короткая строка для отображения (вручную или из выбранного `value` каталога). |
| `tecdoc_transmission_json` | Опциональный снимок выбора из каталога (`title` / `value`), если фронт его передал при создании авто. |

Отдельной таблицы «трансмиссии TecDoc» в схеме приложения **нет** — связь с TecDoc идёт через текст/JSON и через справочник, который читается только при выборе в каталоге.

## Фронтенд

Список КПП подгружается запросом к `passengercars/{id}/transmissions` (см. `VehicleModal.jsx` и thunk `fetchVehicleCatalogTransmissions` в `ProductSlice.js` во фронтенде).
