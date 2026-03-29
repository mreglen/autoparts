import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    if len(sys.argv) != 5:
        raise SystemExit("Usage: render_label_pdf.py <input_html> <output_pdf> <width_mm> <height_mm>")

    input_html = Path(sys.argv[1]).resolve()
    output_pdf = Path(sys.argv[2]).resolve()
    width_mm = int(sys.argv[3])
    height_mm = int(sys.argv[4])

    if not input_html.exists():
        raise SystemExit(f"Input html not found: {input_html}")

    html = input_html.read_text(encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.pdf(
            path=str(output_pdf),
            width=f"{width_mm}mm",
            height=f"{height_mm}mm",
            print_background=True,
            margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
            prefer_css_page_size=True,
        )
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
