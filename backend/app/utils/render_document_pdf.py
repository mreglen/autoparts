import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

# 10 мм — тот же отступ, что задан `@page` в веб-печати заказ-наряда.
MARGIN = {"top": "10mm", "right": "10mm", "bottom": "10mm", "left": "10mm"}


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render_document_pdf.py <input_html> <output_pdf>")

    input_html = Path(sys.argv[1]).resolve()
    output_pdf = Path(sys.argv[2]).resolve()

    if not input_html.exists():
        raise SystemExit(f"Input html not found: {input_html}")

    html = input_html.read_text(encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.pdf(
            path=str(output_pdf),
            format="A4",
            print_background=True,
            margin=MARGIN,
        )
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
