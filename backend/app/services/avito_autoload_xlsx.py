from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
import re
from typing import Any, Optional

from openpyxl import Workbook, load_workbook

TITLE_HEADER = "Название объявления"
PRICE_HEADER = "Цена"
CONDITION_HEADER = "Состояние"
MANUFACTURER_HEADER = "Производитель"
CATEGORY_HEADER = "Категория"
AVITO_STATUS_HEADER = "AvitoStatus"
AVITO_ID_HEADER = "AvitoId"
DESCRIPTION_HEADER = "Описание"
QUANTITY_HEADER = "Количество"
PART_OEM = "Номер детали OEM"
PART_ALT = "Номер детали"
ACTION_HEADER = "Действие"
PHOTOS_HEADER = "Ссылки на фото"
PRODUCT_ID_HEADER = "ProductId"
DEFAULT_SHEET_NAME = "Автозагрузка"
_EXPORT_HEADERS = [
    PART_OEM,
    MANUFACTURER_HEADER,
    CONDITION_HEADER,
    PRICE_HEADER,
    TITLE_HEADER,
    CATEGORY_HEADER,
    AVITO_STATUS_HEADER,
    AVITO_ID_HEADER,
    DESCRIPTION_HEADER,
    QUANTITY_HEADER,
    PHOTOS_HEADER,
    ACTION_HEADER,
    PRODUCT_ID_HEADER,
]
_MANDATORY_HEADERS = {
    PART_OEM,
    MANUFACTURER_HEADER,
    CONDITION_HEADER,
    PRICE_HEADER,
    TITLE_HEADER,
}


def _cell_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
    return str(v).strip()


def _is_mandatory(requirement_cell: Any) -> bool:
    t = _cell_str(requirement_cell).split("\n")[0].strip()
    return t == "Обязательный"


def _find_col_map(header_row: tuple[Any, ...] | list[Any]) -> dict[str, int]:
    m: dict[str, int] = {}
    for idx, val in enumerate(header_row, start=1):
        key = _cell_str(val)
        if key:
            m[key] = idx
    return m


def _part_col(cm: dict[str, int]) -> Optional[int]:
    if PART_OEM in cm:
        return cm[PART_OEM]
    if PART_ALT in cm:
        return cm[PART_ALT]
    return None


def _row_nonempty(row: tuple[Any, ...], cols: list[int]) -> bool:
    for c in cols:
        if c and c - 1 < len(row) and _cell_str(row[c - 1]):
            return True
    return False


def _normalize_header(value: Any) -> str:
    raw = _cell_str(value).strip().lower()
    return re.sub(r"[^a-zа-я0-9]+", "", raw)


def _find_optional_col(cm: dict[str, int], *variants: str) -> Optional[int]:
    normalized = {_normalize_header(k): v for k, v in cm.items()}
    for variant in variants:
        col = normalized.get(_normalize_header(variant))
        if col:
            return col
    return None


def _find_avito_id_col(cm: dict[str, int]) -> Optional[int]:
    # Сначала точные/ожидаемые варианты.
    col = _find_optional_col(
        cm,
        AVITO_ID_HEADER,
        "Уникальный идентификатор объявления",
        "ID объявления",
        "AdId",
        "ID на Авито",
    )
    if col:
        return col

    # Затем более мягкий поиск по нормализованным заголовкам.
    normalized = {_normalize_header(k): v for k, v in cm.items()}
    for key, idx in normalized.items():
        has_id = "id" in key or "айди" in key
        has_ad = "объявлен" in key or "ad" in key
        has_avito = "avito" in key or "авито" in key
        if has_id and (has_ad or has_avito):
            return idx
    return None


def _split_media_urls(raw: str) -> list[str]:
    if not raw:
        return []
    text = raw.replace("\r", "\n").replace(";", ",").replace("|", ",")
    out: list[str] = []
    for chunk in text.replace("\n", ",").split(","):
        url = chunk.strip()
        if not url:
            continue
        out.append(url)
    # Deduplicate while preserving order.
    return list(dict.fromkeys(out))


@dataclass
class AvitoXlsxParseResult:
    items: list[dict[str, Any]] = field(default_factory=list)
    sheets_parsed: list[str] = field(default_factory=list)
    local_errors: list[dict[str, Any]] = field(default_factory=list)
    local_ok: bool = True


def parse_and_validate_avito_autoload(xlsx_bytes: bytes) -> AvitoXlsxParseResult:
    out = AvitoXlsxParseResult()
    bio = BytesIO(xlsx_bytes)
    # read_only даёт усечённые строки у шаблонов Авито — используем обычный режим
    wb = load_workbook(bio, read_only=False, data_only=True)

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        head_rows = list(ws.iter_rows(min_row=1, max_row=4, values_only=True))
        if len(head_rows) < 3:
            continue

        raw_headers = list(head_rows[1])
        raw_req = list(head_rows[2])

        n = len(raw_headers)
        while n > 0 and not _cell_str(raw_headers[n - 1]):
            n -= 1
        headers = raw_headers[:n]
        requirements = (raw_req + [None] * n)[:n]

        if not any(_cell_str(x) == TITLE_HEADER for x in headers):
            continue

        cm = _find_col_map(headers)
        pc = _part_col(cm)
        title_c = cm.get(TITLE_HEADER)
        price_c = cm.get(PRICE_HEADER)
        cond_c = cm.get(CONDITION_HEADER)
        man_c = cm.get(MANUFACTURER_HEADER)
        category_c = cm.get(CATEGORY_HEADER)
        avito_status_c = cm.get(AVITO_STATUS_HEADER)
        avito_id_c = _find_avito_id_col(cm)
        description_c = _find_optional_col(
            cm,
            DESCRIPTION_HEADER,
            "Описание объявления",
            "Описание товара",
            "Description",
        )
        quantity_c = _find_optional_col(cm, QUANTITY_HEADER, "Кол-во", "Кол во", "Qty", "Quantity")
        photos_csv_c = _find_optional_col(
            cm,
            "Ссылки на фото",
            "Фото",
            "Фотографии",
            "Images",
            "ImageUrls",
            "PhotoUrls",
        )
        video_csv_c = _find_optional_col(cm, "Видео", "Video", "VideoUrl", "VideoUrls")
        photo_cols = [
            c
            for c in [
                _find_optional_col(cm, "Фото1"),
                _find_optional_col(cm, "Фото2"),
                _find_optional_col(cm, "Фото3"),
                _find_optional_col(cm, "Фото4"),
                _find_optional_col(cm, "Фото5"),
                _find_optional_col(cm, "Image1"),
                _find_optional_col(cm, "Image2"),
                _find_optional_col(cm, "Image3"),
                _find_optional_col(cm, "Image4"),
                _find_optional_col(cm, "Image5"),
            ]
            if c
        ]

        if not title_c or not price_c or not cond_c:
            out.local_errors.append(
                {
                    "sheet": sheet_name,
                    "message": "На листе нет обязательных колонок шаблона (название, цена, состояние).",
                }
            )
            out.local_ok = False
            continue

        mandatory_cols: list[tuple[int, str]] = []
        for i in range(len(headers)):
            col_idx = i + 1
            h = _cell_str(headers[i])
            if not h:
                continue
            if _is_mandatory(requirements[i] if i < len(requirements) else None):
                mandatory_cols.append((col_idx, h))

        track_cols = [c for c in [pc, man_c, cond_c, price_c, title_c, category_c, avito_status_c] if c]

        for r_idx, row in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
            row_t = tuple(row)
            if not _row_nonempty(row_t, track_cols):
                continue

            for col_idx, label in mandatory_cols:
                val = row_t[col_idx - 1] if col_idx - 1 < len(row_t) else None
                if not _cell_str(val):
                    out.local_errors.append(
                        {
                            "sheet": sheet_name,
                            "row": r_idx,
                            "field": label,
                            "message": "Обязательное поле пустое",
                        }
                    )
                    out.local_ok = False

            price_raw = row_t[price_c - 1] if price_c - 1 < len(row_t) else None
            price_ok = True
            price_display: Any = None
            try:
                if price_raw is None or _cell_str(price_raw) == "":
                    price_ok = False
                else:
                    ptxt = _cell_str(price_raw).replace(" ", "").replace(",", ".")
                    price_display = int(float(ptxt))
            except (TypeError, ValueError):
                price_ok = False

            if not price_ok:
                out.local_errors.append(
                    {
                        "sheet": sheet_name,
                        "row": r_idx,
                        "field": PRICE_HEADER,
                        "message": "Цена должна быть числом (для шаблона — целое)",
                    }
                )
                out.local_ok = False

            def _at(col: Optional[int]) -> str:
                if not col or col - 1 >= len(row_t):
                    return ""
                return _cell_str(row_t[col - 1])

            item = {
                "sheet": sheet_name,
                "row": r_idx,
                "part_number": _at(pc),
                "manufacturer": _at(man_c),
                "condition": _at(cond_c),
                "price": price_display if price_ok else _cell_str(price_raw),
                "title": _at(title_c),
                "category": _at(category_c),
                "avito_status": _at(avito_status_c),
                "avito_id": _at(avito_id_c),
                "description": _at(description_c),
                "quantity": _at(quantity_c),
                "photos": list(
                    dict.fromkeys(
                        _split_media_urls(_at(photos_csv_c))
                        + [p for col in photo_cols for p in _split_media_urls(_at(col))]
                    )
                ),
                "videos": _split_media_urls(_at(video_csv_c)),
            }
            out.items.append(item)

        out.sheets_parsed.append(sheet_name)

    wb.close()
    return out


def _create_autoload_workbook() -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = DEFAULT_SHEET_NAME
    ws.append([""] * len(_EXPORT_HEADERS))
    ws.append(_EXPORT_HEADERS)
    ws.append(["Обязательный" if h in _MANDATORY_HEADERS else "Необязательный" for h in _EXPORT_HEADERS])
    ws.append([""] * len(_EXPORT_HEADERS))
    return wb


def _normalize_media_url(url: str, public_base_url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    normalized_base = (public_base_url or "").rstrip("/")
    if not normalized_base:
        return value
    if value.startswith("/temp/"):
        return f"{normalized_base}/uploads{value}"
    if value.startswith("/pictures/") or value.startswith("/videos/") or value.startswith("/vehicle_pictures/"):
        return f"{normalized_base}/uploads{value}"
    if value.startswith("/"):
        return f"{normalized_base}{value}"
    return f"{normalized_base}/{value.lstrip('/')}"


def upsert_products_to_avito_autoload(
    existing_xlsx: Optional[bytes],
    products: list[dict[str, Any]],
    *,
    public_base_url: str,
) -> bytes:
    wb = load_workbook(BytesIO(existing_xlsx), read_only=False) if existing_xlsx else _create_autoload_workbook()
    ws = wb[wb.sheetnames[0]]
    header = [str(v).strip() if v is not None else "" for v in ws[2]]
    col_map = {name: idx for idx, name in enumerate(header, start=1) if name}

    for required_header in _EXPORT_HEADERS:
        if required_header not in col_map:
            col_idx = ws.max_column + 1
            ws.cell(row=2, column=col_idx, value=required_header)
            ws.cell(
                row=3,
                column=col_idx,
                value="Обязательный" if required_header in _MANDATORY_HEADERS else "Необязательный",
            )
            col_map[required_header] = col_idx

    row_index_by_product_id: dict[str, int] = {}
    row_index_by_avito_id: dict[str, int] = {}
    row_index_by_part: dict[str, int] = {}
    for row_no in range(5, ws.max_row + 1):
        pid = str(ws.cell(row=row_no, column=col_map[PRODUCT_ID_HEADER]).value or "").strip()
        aid = str(ws.cell(row=row_no, column=col_map[AVITO_ID_HEADER]).value or "").strip()
        part = str(ws.cell(row=row_no, column=col_map[PART_OEM]).value or "").strip()
        if pid:
            row_index_by_product_id[pid] = row_no
        if aid:
            row_index_by_avito_id[aid] = row_no
        if part:
            row_index_by_part[part] = row_no

    for product in products:
        product_id = str(product.get("id") or "").strip()
        avito_id = str(product.get("avito_id") or "").strip()
        part_number = str(product.get("article") or "").strip()
        target_row = (
            row_index_by_product_id.get(product_id)
            or (row_index_by_avito_id.get(avito_id) if avito_id else None)
            or (row_index_by_part.get(part_number) if part_number else None)
        )
        if not target_row:
            target_row = max(ws.max_row + 1, 5)

        photos = product.get("photos") or []
        photo_urls = []
        for raw_url in photos:
            normalized = _normalize_media_url(str(raw_url), public_base_url)
            if normalized:
                photo_urls.append(normalized)
        photo_urls = list(dict.fromkeys(photo_urls))

        row_values = {
            PART_OEM: part_number,
            MANUFACTURER_HEADER: str(product.get("brand") or ""),
            CONDITION_HEADER: "Новое" if bool(product.get("is_new")) else "Б/у",
            PRICE_HEADER: float(product.get("price") or 0),
            TITLE_HEADER: str(product.get("name") or part_number or f"Товар {product_id}"),
            CATEGORY_HEADER: str(product.get("category") or ""),
            AVITO_STATUS_HEADER: str(product.get("avito_status") or ""),
            AVITO_ID_HEADER: avito_id,
            DESCRIPTION_HEADER: str(product.get("description") or ""),
            QUANTITY_HEADER: int(product.get("quantity") or 0),
            PHOTOS_HEADER: "\n".join(photo_urls),
            ACTION_HEADER: str(product.get("action") or "Добавить"),
            PRODUCT_ID_HEADER: product_id,
        }
        for h, value in row_values.items():
            ws.cell(row=target_row, column=col_map[h], value=value)

        if product_id:
            row_index_by_product_id[product_id] = target_row
        if avito_id:
            row_index_by_avito_id[avito_id] = target_row
        if part_number:
            row_index_by_part[part_number] = target_row

    out = BytesIO()
    wb.save(out)
    wb.close()
    return out.getvalue()

