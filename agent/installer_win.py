"""
Windows installer for AutoParts Printer Agent.
Copies the bundled app exe to Program Files and creates a Start Menu shortcut.
Does not launch the application after installation.
"""

from __future__ import annotations

import os
import shutil
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk


APP_EXE_NAME = "AutoParts_PrinterAgent.exe"
APP_DISPLAY_NAME = "AutoParts — агент печати"
START_MENU_FOLDER = "AutoParts"
SHORTCUT_NAME = "Агент печати AutoParts.lnk"
UNINSTALL_REG_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoPartsPrinterAgent"


def _resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent


def _bundled_app_exe() -> Path:
    candidate = _resource_root() / APP_EXE_NAME
    if candidate.exists():
        return candidate
    fallback = Path(__file__).resolve().parent / "dist" / APP_EXE_NAME
    if fallback.exists():
        return fallback
    raise FileNotFoundError(f"Не найден встроенный файл {APP_EXE_NAME}")


def default_install_dir() -> Path:
    program_files = os.environ.get("ProgramFiles") or r"C:\Program Files"
    return Path(program_files) / "AutoParts" / "PrinterAgent"


def _create_shortcut_win32(target_exe: Path, shortcut_path: Path) -> None:
    import win32com.client

    shortcut_path.parent.mkdir(parents=True, exist_ok=True)
    shell = win32com.client.Dispatch("WScript.Shell")
    shortcut = shell.CreateShortCut(str(shortcut_path))
    shortcut.Targetpath = str(target_exe)
    shortcut.WorkingDirectory = str(target_exe.parent)
    shortcut.IconLocation = str(target_exe)
    shortcut.Description = APP_DISPLAY_NAME
    shortcut.save()


def _create_shortcut_powershell(target_exe: Path, shortcut_path: Path) -> None:
    shortcut_path.parent.mkdir(parents=True, exist_ok=True)
    ps = (
        "$ws = New-Object -ComObject WScript.Shell; "
        f"$s = $ws.CreateShortcut('{shortcut_path}'); "
        f"$s.TargetPath = '{target_exe}'; "
        f"$s.WorkingDirectory = '{target_exe.parent}'; "
        f"$s.IconLocation = '{target_exe}'; "
        f"$s.Description = '{APP_DISPLAY_NAME}'; "
        "$s.Save()"
    )
    import subprocess

    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        check=True,
        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
    )


def create_start_menu_shortcut(target_exe: Path) -> Path:
    programs = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
    shortcut_path = programs / START_MENU_FOLDER / SHORTCUT_NAME
    try:
        _create_shortcut_win32(target_exe, shortcut_path)
    except Exception:
        _create_shortcut_powershell(target_exe, shortcut_path)
    return shortcut_path


def register_uninstall(install_dir: Path, app_exe: Path) -> None:
    try:
        import win32api
        import win32con
    except ImportError:
        return

    try:
        key = win32api.RegCreateKey(win32con.HKEY_CURRENT_USER, UNINSTALL_REG_KEY)
        win32api.RegSetValueEx(key, "DisplayName", 0, win32con.REG_SZ, APP_DISPLAY_NAME)
        win32api.RegSetValueEx(key, "DisplayVersion", 0, win32con.REG_SZ, "1.0.0")
        win32api.RegSetValueEx(key, "Publisher", 0, win32con.REG_SZ, "AutoParts")
        win32api.RegSetValueEx(key, "InstallLocation", 0, win32con.REG_SZ, str(install_dir))
        win32api.RegSetValueEx(key, "DisplayIcon", 0, win32con.REG_SZ, str(app_exe))
        win32api.RegCloseKey(key)
    except Exception:
        pass


def install_to(target_dir: Path) -> Path:
    source = _bundled_app_exe()
    target_dir.mkdir(parents=True, exist_ok=True)
    target_exe = target_dir / APP_EXE_NAME

    if target_exe.exists():
        try:
            target_exe.unlink()
        except PermissionError as exc:
            raise PermissionError(
                "Не удалось обновить программу: агент печати, возможно, запущен. "
                "Закройте его и повторите установку."
            ) from exc

    shutil.copy2(source, target_exe)
    create_start_menu_shortcut(target_exe)
    register_uninstall(target_dir, target_exe)
    return target_exe


class InstallerApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Установка — AutoParts Printer Agent")
        self.root.resizable(False, False)
        self.root.minsize(520, 280)

        self.install_dir = tk.StringVar(value=str(default_install_dir()))
        self.status = tk.StringVar(value="Нажмите «Установить», чтобы скопировать программу на компьютер.")

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.root.destroy)

    def _build_ui(self) -> None:
        frame = ttk.Frame(self.root, padding=20)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="Установка агента печати AutoParts", font=("Segoe UI", 14, "bold")).pack(
            anchor="w"
        )
        ttk.Label(
            frame,
            text="Программа будет установлена в выбранную папку. Ярлык появится в меню «Пуск».",
            wraplength=460,
        ).pack(anchor="w", pady=(8, 16))

        path_row = ttk.Frame(frame)
        path_row.pack(fill="x", pady=(0, 8))
        ttk.Label(path_row, text="Папка установки:").pack(anchor="w")
        entry_row = ttk.Frame(path_row)
        entry_row.pack(fill="x", pady=(4, 0))
        ttk.Entry(entry_row, textvariable=self.install_dir).pack(side="left", fill="x", expand=True)
        ttk.Button(entry_row, text="Обзор…", command=self._browse).pack(side="left", padx=(8, 0))

        ttk.Label(frame, textvariable=self.status, wraplength=460, foreground="#374151").pack(
            anchor="w", pady=(12, 16)
        )

        btn_row = ttk.Frame(frame)
        btn_row.pack(fill="x")
        ttk.Button(btn_row, text="Отмена", command=self.root.destroy).pack(side="right")
        self.install_btn = ttk.Button(btn_row, text="Установить", command=self._on_install)
        self.install_btn.pack(side="right", padx=(0, 8))

    def _browse(self) -> None:
        chosen = filedialog.askdirectory(
            title="Выберите папку установки",
            initialdir=self.install_dir.get() or str(default_install_dir()),
        )
        if chosen:
            self.install_dir.set(chosen)

    def _on_install(self) -> None:
        target = Path(self.install_dir.get().strip())
        if not target:
            messagebox.showerror("Ошибка", "Укажите папку установки.")
            return

        self.install_btn.configure(state="disabled")
        self.status.set("Установка…")
        self.root.update_idletasks()

        try:
            app_exe = install_to(target)
        except PermissionError as exc:
            messagebox.showerror("Ошибка установки", str(exc))
            self.status.set("Установка не выполнена.")
            self.install_btn.configure(state="normal")
            return
        except Exception as exc:
            messagebox.showerror("Ошибка установки", str(exc))
            self.status.set("Установка не выполнена.")
            self.install_btn.configure(state="normal")
            return

        self.status.set(f"Готово. Программа установлена в:\n{app_exe.parent}")
        messagebox.showinfo(
            "Установка завершена",
            f"Агент печати установлен.\n\nПапка:\n{app_exe.parent}\n\n"
            "Запустите программу из меню «Пуск» → AutoParts → Агент печати AutoParts.",
        )
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    InstallerApp().run()


if __name__ == "__main__":
    main()
