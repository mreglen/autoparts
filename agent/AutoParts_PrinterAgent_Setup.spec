# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


ROOT = Path(SPECPATH).parent
AGENT_DIR = ROOT / "agent"
APP_EXE = AGENT_DIR / "dist" / "AutoParts_PrinterAgent.exe"

if not APP_EXE.exists():
    raise SystemExit(
        f"Сначала соберите приложение: {APP_EXE} не найден. "
        "Запустите PyInstaller для AutoParts_PrinterAgent.spec."
    )


a = Analysis(
    [str(AGENT_DIR / "installer_win.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[(str(APP_EXE), ".")],
    hiddenimports=[
        "win32com",
        "win32com.client",
        "pythoncom",
        "pywintypes",
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
    uac_admin=True,
)
