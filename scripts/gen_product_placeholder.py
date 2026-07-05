"""Собирает fallback-изображение для карточек без фото: лого сайта на белом фоне.

Запуск: py scripts/gen_product_placeholder.py
Результат: frontend/my-autoparts/public/img/product-placeholder-white.png (1200x1200, RGB).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "frontend" / "my-autoparts" / "public" / "img" / "LogoWithoutBg.png"
OUT = ROOT / "frontend" / "my-autoparts" / "public" / "img" / "product-placeholder-white.png"

CANVAS = 1200
LOGO_RATIO = 0.62  # доля ширины холста под лого


def main() -> None:
    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    logo = Image.open(LOGO).convert("RGBA")

    target_w = int(CANVAS * LOGO_RATIO)
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    logo = logo.resize((target_w, target_h), Image.LANCZOS)

    x = (CANVAS - target_w) // 2
    y = (CANVAS - target_h) // 2
    canvas.paste(logo, (x, y), logo)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "PNG", optimize=True)
    print(f"saved {OUT} ({canvas.size})")


if __name__ == "__main__":
    main()
