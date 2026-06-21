"""SQL-выражения для нормализации полей при поиске товаров."""
from __future__ import annotations

from sqlalchemy import func


def get_sql_normalize(col):
    """Нормализация артикула: upper + удаление разделителей."""
    return func.replace(
        func.replace(
            func.replace(
                func.replace(
                    func.replace(
                        func.replace(
                            func.replace(func.upper(col), "-", ""),
                            " ",
                            "",
                        ),
                        ".",
                        "",
                    ),
                    "/",
                    "",
                ),
                "(",
                "",
            ),
            ")",
            "",
        ),
        "_",
        "",
    )


def get_sql_normalize_brand(col):
    """Нормализация бренда (MANN-FILTER == MANN FILTER)."""
    return func.replace(
        func.replace(func.replace(func.upper(col), "-", ""), " ", ""),
        "/",
        "",
    )
