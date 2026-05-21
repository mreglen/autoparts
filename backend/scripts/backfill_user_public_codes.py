"""Alias for remigrate_user_public_codes.py (same behavior)."""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "remigrate_user_public_codes.py"), run_name="__main__")
