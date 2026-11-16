"""Дамп OpenAPI для мобильного клиента (mobile/docs/stages/02-app-scaffold.md, раздел 4).

    python scripts/export_openapi.py                 # мобильный срез -> mobile/app/src/api/openapi.json
    python scripts/export_openapi.py --full           # весь контракт
    python scripts/export_openapi.py --out spec.json

Мобильный срез — фильтр по префиксу пути, а не по тегу: у части автосервис-роутеров
тега нет, а префиксы `/api/autoservice/…` стабильны. Список пополняется вместе с этапами.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_OUT = REPO_ROOT / "mobile" / "app" / "src" / "api" / "openapi.json"
PREFIX = "#/components/schemas/"

# Путь должен начинаться с одного из префиксов. `{…}` в префиксе не допускается.
MOBILE_PATH_PREFIXES = (
    "/api/auth/",
    "/api/users/me",
    "/api/mobile/",
    "/api/tasks/",
    "/api/autoservice/",
    "/api/public/autoservice/",
    "/api/organizations/",
    "/api/notifications/",
)

# Из /api/organizations/ мобильному клиенту нужны только карточки сотрудников.
MOBILE_PATH_EXTRA_ALLOW = (
    re.compile(r"^/api/organizations/\{[^}]+\}/employee-cards"),
)


def is_mobile_path(path: str) -> bool:
    if any(path.startswith(prefix) for prefix in MOBILE_PATH_PREFIXES):
        if path.startswith("/api/organizations/"):
            return any(pattern.match(path) for pattern in MOBILE_PATH_EXTRA_ALLOW)
        return True
    return False


def prune(spec: dict) -> dict:
    paths = spec.get("paths", {})
    kept = {path: ops for path, ops in paths.items() if is_mobile_path(path)}
    removed = sorted(set(paths) - set(kept))
    components = spec.get("components", {})
    schemas = components.get("schemas", {})
    used = _closure(kept, schemas)
    kept_schemas = {name: schemas[name] for name in used if name in schemas}
    print(f"Оставлено путей: {len(kept)} из {len(paths)}")
    if removed:
        print("Исключено (первые 10): " + ", ".join(removed[:10]))
    print(f"Оставлено схем: {len(kept_schemas)} из {len(schemas)}")
    return {
        **spec,
        "paths": kept,
        "components": {**components, "schemas": kept_schemas},
    }


def _refs(node: object) -> set[str]:
    found: set[str] = set()
    stack = [node]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            for key, value in current.items():
                if key == "$ref" and isinstance(value, str):
                    if value.startswith(PREFIX):
                        found.add(value.rsplit("/", 1)[-1])
                elif isinstance(value, (dict, list)):
                    stack.append(value)
        elif isinstance(current, list):
            stack.extend(item for item in current if isinstance(item, (dict, list)))
    return found


def _closure(paths: dict, schemas: dict) -> set[str]:
    """Схемы, до которых можно дойти из оставленных путей, включая вложенные $ref."""
    needed = _refs(paths)
    seen: set[str] = set()
    while needed - seen:
        name = (needed - seen).pop()
        seen.add(name)
        if name in schemas:
            needed |= _refs(schemas[name])
    return seen


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="куда писать spec")
    parser.add_argument("--full", action="store_true", help="не резать по мобильному срезу")
    parser.add_argument("--check", action="store_true", help="не писать, а проверить, что файл актуален")
    args = parser.parse_args()

    sys.path.insert(0, str(BACKEND_ROOT))
    if sys.platform == "win32":
        import types

        # app.utils.* импортирует fcntl для file-lock; на Windows его нет.
        sys.modules.setdefault("fcntl", types.ModuleType("fcntl"))

    from app.main import app

    spec = app.openapi()
    if not args.full:
        spec = prune(spec)
    payload = json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

    out = Path(args.out)
    if args.check:
        current = out.read_text(encoding="utf-8") if out.exists() else ""
        if current != payload:
            print(f"Устарел {out}: нужно перегенерировать export_openapi.py")
            return 1
        print(f"{out} актуален")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(payload, encoding="utf-8")
    print(f"Записано: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
