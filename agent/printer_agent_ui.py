import asyncio
import re
import threading
import tkinter as tk
from tkinter import ttk, messagebox

import customtkinter as ctk
import json
import os
from queue import Queue, Empty
from datetime import datetime
from pathlib import Path

try:
    from .printer_agent import PrinterAgent
except ImportError:
    from printer_agent import PrinterAgent


def _safe_str(x):
    if x is None:
        return ""
    return str(x)


# Сообщения агента (англ.) → русские строки для статусной строки
_STATUS_RU = {
    "connecting": "Подключение",
    "connected": "Подключено",
    "disconnected": "Отключено",
    "auth_error": "Ошибка авторизации",
    "error": "Ошибка",
    "pong": "Отклик",
}


def _localize_connection_message(msg: str) -> str:
    if not msg:
        return ""
    m = str(msg)
    if m.startswith("Attempting to connect to "):
        return "Попытка подключения к " + m[len("Attempting to connect to ") :]
    if m == "WebSocket connected":
        return "Соединение WebSocket установлено"
    if m.startswith("Connection closed:"):
        return "Соединение закрыто" + m[len("Connection closed:") :]
    if "Invalid printer token" in m:
        return "Неверный токен принтера или ID организации (HTTP 401)"
    if m == "Connection refused":
        return "В соединении отказано"
    return m


def _localize_job_status(status: str) -> str:
    s = (status or "").lower()
    return {
        "pending": "Ожидание",
        "printing": "Печать",
        "success": "Готово",
        "error": "Ошибка",
        "failed": "Ошибка",
    }.get(s, status or "")


def _localize_job_message(msg: str) -> str:
    if not msg:
        return ""
    m = str(msg)
    if m == "Queued":
        return "В очереди"
    if m == "Printing...":
        return "Печать…"
    if m == "Printing PDF...":
        return "Печать PDF…"
    m = re.sub(r"^Printed x(\d+)$", r"Напечатано ×\1", m)
    m = re.sub(r"^Printed PDF x(\d+)$", r"PDF напечатано ×\1", m)
    m = re.sub(r"^Print job sent to (.+)$", r"Задание отправлено на «\1»", m)
    return m


class PrinterAgentUI:
    def __init__(self, root: ctk.CTk):
        self.root = root
        self.root.title("Агент печати — Автозапчасти")
        self.root.minsize(720, 520)
        self.root.geometry("960x620")
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(2, weight=1)

        self.ACCENT_DARK = "#2563eb"
        self.BG = "#f6f8fc"
        self.PANEL = "#ffffff"
        self.TEXT = "#111827"

        self.events_q: Queue = Queue()
        self.agent = None
        self.agent_thread = None
        self.local_unknown_job_counter = 0
        self._auth_store_path = self._get_auth_store_path()
        self._saved_token = ""
        self._saved_org_id = ""

        self.style = ttk.Style(self.root)
        self._apply_theme()

        self._build_ui()

        try:
            saved = self._load_saved_auth()
            self._saved_token = saved.get("printer_token", "") or ""
            self._saved_org_id = saved.get("organization_id", "") or ""
        except Exception:
            self._saved_token = ""
            self._saved_org_id = ""

        if self._saved_token:
            self.token_var.set(self._saved_token)
        if self._saved_org_id:
            self.org_var.set(self._saved_org_id)

        self.root.after(200, self._poll_events)

    def _get_auth_store_path(self) -> Path:
        app_dir = Path(os.getenv("APPDATA", "")) / "AutoParts" / "printer_agent"
        return app_dir / "auth.json"

    def _load_saved_auth(self) -> dict:
        path = self._auth_store_path
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _save_auth(self, printer_token: str, organization_id: str) -> None:
        path = self._auth_store_path
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(
                {
                    "printer_token": printer_token,
                    "organization_id": organization_id,
                },
                f,
                ensure_ascii=False,
            )

    def _clear_token(self):
        if messagebox.askyesno(
            "Очистить токен",
            "Удалить сохранённый токен принтера из поля и из файла настроек?",
        ):
            self.token_var.set("")
            try:
                self._save_auth("", self.org_var.get().strip())
                self._saved_token = ""
            except Exception as e:
                messagebox.showwarning("Внимание", f"Не удалось сохранить: {e}")

    def _clear_org_id(self):
        if messagebox.askyesno(
            "Очистить ID организации",
            "Удалить ID организации из поля и из файла настроек?",
        ):
            self.org_var.set("")
            try:
                self._save_auth(self.token_var.get().strip(), "")
                self._saved_org_id = ""
            except Exception as e:
                messagebox.showwarning("Внимание", f"Не удалось сохранить: {e}")

    def _apply_theme(self):
        ctk.set_appearance_mode("light")
        try:
            ctk.set_default_color_theme("blue")
        except Exception:
            pass

        try:
            self.style.configure("Treeview", rowheight=26, font=("Segoe UI", 10))
            self.style.configure("Treeview.Heading", font=("Segoe UI", 10, "bold"))
        except tk.TclError:
            pass

    def _status_to_tag(self, status: str) -> str:
        s = (status or "").lower()
        if s == "pending":
            return "tag_pending"
        if s == "printing":
            return "tag_printing"
        if s == "success":
            return "tag_success"
        if s == "error" or s == "failed":
            return "tag_error"
        return "tag_unknown"

    def _build_ui(self):
        top = ctk.CTkFrame(self.root, fg_color=self.BG)
        top.grid(row=0, column=0, sticky="nsew", padx=14, pady=(14, 8))
        top.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(top, text="Токен принтера", anchor="w", text_color=self.TEXT).grid(
            row=0, column=0, sticky="nw", padx=(4, 10), pady=(4, 2)
        )
        self.token_var = tk.StringVar()
        token_row = ctk.CTkFrame(top, fg_color="transparent")
        token_row.grid(row=0, column=1, sticky="ew", pady=(4, 2))
        token_row.grid_columnconfigure(0, weight=1)

        self.token_entry = ctk.CTkEntry(token_row, textvariable=self.token_var, height=34)
        self.token_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self.clear_token_btn = ctk.CTkButton(
            token_row,
            text="Очистить",
            width=88,
            height=32,
            command=self._clear_token,
            fg_color="#fee2e2",
            hover_color="#fecaca",
            text_color="#991b1b",
        )
        self.clear_token_btn.grid(row=0, column=1, padx=(0, 0))

        ctk.CTkLabel(top, text="ID организации", anchor="w", text_color=self.TEXT).grid(
            row=1, column=0, sticky="nw", padx=(4, 10), pady=(8, 2)
        )
        org_row = ctk.CTkFrame(top, fg_color="transparent")
        org_row.grid(row=1, column=1, sticky="ew", pady=(8, 2))
        org_row.grid_columnconfigure(0, weight=1)

        self.org_var = tk.StringVar()
        self.org_entry = ctk.CTkEntry(org_row, textvariable=self.org_var, height=34)
        self.org_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self.clear_org_btn = ctk.CTkButton(
            org_row,
            text="Очистить",
            width=88,
            height=32,
            command=self._clear_org_id,
            fg_color="#fee2e2",
            hover_color="#fecaca",
            text_color="#991b1b",
        )
        self.clear_org_btn.grid(row=0, column=1)

        btn_row = ctk.CTkFrame(top, fg_color="transparent")
        btn_row.grid(row=2, column=1, sticky="w", pady=(12, 4))

        self.connect_btn = ctk.CTkButton(
            btn_row,
            text="Подключиться и запустить агент",
            command=self._on_connect,
            width=220,
            height=36,
            fg_color=self.ACCENT_DARK,
            hover_color="#1d4ed8",
        )
        self.connect_btn.pack(side="left", padx=(0, 10))

        self.disconnect_btn = ctk.CTkButton(
            btn_row,
            text="Остановить",
            command=self._on_stop,
            width=120,
            height=36,
            state="disabled",
            fg_color="#94a3b8",
            hover_color="#64748b",
        )
        self.disconnect_btn.pack(side="left")

        hint = ctk.CTkLabel(
            top,
            text="Токен и ID можно менять в любой момент; после изменения нажмите «Подключиться…» снова.",
            anchor="w",
            text_color="#64748b",
            font=("Segoe UI", 11),
            wraplength=900,
            justify="left",
        )
        hint.grid(row=3, column=0, columnspan=2, sticky="w", padx=(4, 8), pady=(4, 0))

        self.status_var = tk.StringVar(value="Не подключено")
        self.status_badge = ctk.CTkLabel(
            self.root,
            textvariable=self.status_var,
            fg_color="#e9f6ff",
            text_color="#0f172a",
            corner_radius=10,
            padx=12,
            pady=10,
            font=("Segoe UI", 10, "bold"),
            anchor="w",
            wraplength=920,
            justify="left",
        )
        self.status_badge.grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 8))

        body = ctk.CTkFrame(self.root, fg_color=self.PANEL, corner_radius=14, border_width=1, border_color="#e5e7eb")
        body.grid(row=2, column=0, sticky="nsew", padx=14, pady=(0, 14))
        body.grid_rowconfigure(0, weight=1)
        body.grid_columnconfigure(0, weight=1)

        queue_frame = ctk.CTkFrame(body, fg_color="#ffffff", corner_radius=12)
        queue_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        queue_frame.grid_rowconfigure(1, weight=1)
        queue_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(queue_frame, text="Очередь печати", text_color=self.TEXT, font=("Segoe UI", 13, "bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=(12, 6)
        )

        queue_container = ctk.CTkFrame(queue_frame, fg_color="transparent")
        queue_container.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 12))
        queue_container.grid_rowconfigure(0, weight=1)
        queue_container.grid_columnconfigure(0, weight=1)

        self.queue_tree = ttk.Treeview(
            queue_container,
            columns=("job_id", "printer", "status", "message", "timestamp"),
            show="headings",
            selectmode="browse",
        )
        self.queue_tree.heading("job_id", text="№ задания")
        self.queue_tree.heading("printer", text="Принтер")
        self.queue_tree.heading("status", text="Статус")
        self.queue_tree.heading("message", text="Сообщение")
        self.queue_tree.heading("timestamp", text="Время")

        self.queue_tree.column("job_id", width=100, minwidth=70, stretch=False)
        self.queue_tree.column("printer", width=200, minwidth=120, stretch=True)
        self.queue_tree.column("status", width=110, minwidth=80, stretch=False)
        self.queue_tree.column("message", width=300, minwidth=160, stretch=True)
        self.queue_tree.column("timestamp", width=180, minwidth=140, stretch=False)

        self.queue_tree.tag_configure("tag_pending", background="#fff7cc")
        self.queue_tree.tag_configure("tag_printing", background="#e0f2fe")
        self.queue_tree.tag_configure("tag_success", background="#dcfce7")
        self.queue_tree.tag_configure("tag_error", background="#fee2e2")
        self.queue_tree.tag_configure("tag_unknown", background="")

        yscroll = ttk.Scrollbar(queue_container, orient="vertical", command=self.queue_tree.yview)
        xscroll = ttk.Scrollbar(queue_container, orient="horizontal", command=self.queue_tree.xview)
        self.queue_tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)

        self.queue_tree.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")

        queue_container.grid_rowconfigure(0, weight=1)
        queue_container.grid_columnconfigure(0, weight=1)

    def _upsert_job_row(self, event: dict):
        job_id = event.get("job_id")
        job_id_str = _safe_str(job_id)

        if not job_id_str:
            self.local_unknown_job_counter += 1
            job_id_str = f"лок-{self.local_unknown_job_counter}"

        values = (
            job_id_str,
            event.get("printer_name", ""),
            _localize_job_status(event.get("status", "")),
            _localize_job_message(event.get("message", "")),
            event.get("timestamp", ""),
        )

        tag = self._status_to_tag(event.get("status", ""))

        existing_id = None
        for item in self.queue_tree.get_children():
            item_values = self.queue_tree.item(item, "values")
            if item_values and item_values[0] == job_id_str:
                existing_id = item
                break

        if existing_id:
            self.queue_tree.item(existing_id, values=values, tags=(tag,))
        else:
            self.queue_tree.insert("", "end", values=values, tags=(tag,))

    def _on_connect(self):
        token = self.token_var.get().strip()
        org_id = self.org_var.get().strip()

        if not token or not org_id:
            messagebox.showwarning(
                "Нет данных",
                "Введите токен принтера и ID организации.",
            )
            return

        if self.agent_thread and self.agent_thread.is_alive():
            messagebox.showinfo("Уже запущено", "Агент уже работает. Сначала нажмите «Остановить», чтобы сменить параметры.")
            return

        def connection_cb(ev):
            self.events_q.put(("connection", ev))

        def job_cb(ev):
            self.events_q.put(("job", ev))

        try:
            self._save_auth(token, org_id)
        except Exception as e:
            messagebox.showwarning("Внимание", f"Не удалось сохранить настройки: {e}")

        self.agent = PrinterAgent(
            auth_token=token,
            organization_id=org_id,
            on_connection_updated=connection_cb,
            on_job_updated=job_cb,
        )

        def run():
            try:
                asyncio.run(self.agent.run())
            except Exception as e:
                self.events_q.put(
                    ("connection", {"status": "error", "message": str(e), "timestamp": datetime.now().isoformat()})
                )

        self.agent_thread = threading.Thread(target=run, daemon=True)
        self.agent_thread.start()

        self.connect_btn.configure(state="disabled")
        self.disconnect_btn.configure(state="normal")
        self.status_var.set("Запуск агента…")
        self.status_badge.configure(fg_color="#e9f6ff", text_color="#0f172a")

    def _on_stop(self):
        if self.agent:
            try:
                self.agent.stop()
            except Exception:
                pass
        self.connect_btn.configure(state="normal")
        self.disconnect_btn.configure(state="disabled")
        self.status_var.set("Остановлено")
        self.status_badge.configure(fg_color="#eef2ff", text_color="#1f2937")

    def _format_connection_line(self, payload: dict) -> str:
        status = payload.get("status", "")
        msg = _localize_connection_message(payload.get("message", ""))
        ts = payload.get("timestamp", "")
        sr = _STATUS_RU.get((status or "").lower(), status or "")
        return f"{sr}: {msg} ({ts})"

    def _poll_events(self):
        try:
            while True:
                typ, payload = self.events_q.get_nowait()

                if typ == "connection":
                    self.status_var.set(self._format_connection_line(payload))
                    s = (payload.get("status") or "").lower()
                    if s in ("connected", "pong"):
                        self.status_badge.configure(fg_color="#dcfce7", text_color="#065f46")
                    elif s in ("connecting",):
                        self.status_badge.configure(fg_color="#e9f6ff", text_color="#0f172a")
                    elif s in ("auth_error",):
                        self.status_badge.configure(fg_color="#fee2e2", text_color="#7f1d1d")
                    elif s in ("disconnected",):
                        self.status_badge.configure(fg_color="#fff7cc", text_color="#3a2a0a")
                    elif s in ("error",):
                        self.status_badge.configure(fg_color="#fee2e2", text_color="#7f1d1d")
                elif typ == "job":
                    self._upsert_job_row(payload)

        except Empty:
            pass

        self.root.after(200, self._poll_events)


def main():
    root = ctk.CTk(fg_color="#f6f8fc")
    app = PrinterAgentUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
