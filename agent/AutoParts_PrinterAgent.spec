# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


ROOT = Path(SPECPATH).parent
AGENT_DIR = ROOT / "agent"


a = Analysis(
    [str(AGENT_DIR / "printer_agent_ui.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "agent.printer_agent",
        "customtkinter",
        "fitz",
        "PIL.Image",
        "PIL.ImageWin",
        "PIL._tkinter_finder",
        "win32print",
        "win32ui",
        "win32con",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="AutoParts_PrinterAgent_Setup",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(AGENT_DIR / "assets" / "img" / "logo.ico"),
)
