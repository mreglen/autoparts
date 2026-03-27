import asyncio
import threading
import tkinter as tk
from tkinter import ttk, messagebox

import customtkinter as ctk
import json
import os
from queue import Queue, Empty
from datetime import datetime
from pathlib import Path

from printer_agent import PrinterAgent


def _safe_str(x):
    if x is None:
        return ""
    return str(x)


class PrinterAgentUI:
    def __init__(self, root: ctk.CTk):
        self.root = root
        self.root.title("AutoParts Printer Agent")
        self.root.geometry("1050x600")
        # Цвета в стиле сайта: мягкий светлый фон + синий акцент.
        self.ACCENT = "#61dafb"
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

        # Автовосстановление токена/organization_id
        try:
            saved = self._load_saved_auth()
            self._saved_token = saved.get("printer_token", "") or ""
            self._saved_org_id = saved.get("organization_id", "") or ""
        except Exception:
            # Если файл не читается/поврежден — не мешаем старту UI
            self._saved_token = ""
            self._saved_org_id = ""

        if self._saved_token:
            self.token_var.set(self._saved_token)
        if self._saved_org_id:
            self.org_var.set(self._saved_org_id)

        self.root.after(200, self._poll_events)

    def _get_auth_store_path(self) -> Path:
        # Храним в AppData, чтобы не терялось при перезапуске и не засоряло проект.
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

    def _apply_theme(self):
        ctk.set_appearance_mode("light")
        try:
            ctk.set_default_color_theme("blue")
        except Exception:
            # На некоторых системах может отсутствовать дефолтная тема.
            pass

        # Общие визуальные параметры
        try:
            self.style.configure("Treeview", rowheight=24, font=("Segoe UI", 9))
            self.style.configure("Treeview.Heading", font=("Segoe UI", 9, "bold"))
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
        top = ctk.CTkFrame(self.root, fg_color="transparent")
        top.pack(fill="x", padx=12, pady=(12, 6))

        token_title = ctk.CTkLabel(top, text="Printer token:", anchor="w", text_color=self.TEXT)
        token_title.grid(row=0, column=0, sticky="w", padx=(2, 6))
        self.token_var = tk.StringVar()
        token_entry = ctk.CTkEntry(top, textvariable=self.token_var, show="*", width=420)
        token_entry.grid(row=0, column=1, sticky="w", padx=(0, 10))

        org_title = ctk.CTkLabel(top, text="Organization ID:", anchor="w", text_color=self.TEXT)
        org_title.grid(row=0, column=2, sticky="w", padx=(2, 6))
        self.org_var = tk.StringVar()
        org_entry = ctk.CTkEntry(top, textvariable=self.org_var, width=280)
        org_entry.grid(row=0, column=3, sticky="w")

        self.connect_btn = ctk.CTkButton(
            top,
            text="Connect / Start agent",
            command=self._on_connect,
            fg_color=self.ACCENT_DARK,
            hover_color="#1d4ed8",
        )
        self.connect_btn.grid(row=0, column=4, sticky="e", padx=(12, 10))

        self.disconnect_btn = ctk.CTkButton(
            top,
            text="Stop",
            command=self._on_stop,
            state="disabled",
            fg_color="#94a3b8",
            hover_color="#64748b",
        )
        self.disconnect_btn.grid(row=0, column=5, sticky="e", padx=(6, 2))

        self.status_var = tk.StringVar(value="Не подключен")
        self.status_badge = ctk.CTkLabel(
            self.root,
            textvariable=self.status_var,
            fg_color="#e9f6ff",
            text_color="#0f172a",
            corner_radius=10,
            padx=12,
            pady=8,
            font=("Segoe UI", 10, "bold"),
            anchor="w",
        )
        self.status_badge.pack(fill="x", padx=12, pady=(0, 10))

        body = ctk.CTkFrame(self.root, fg_color=self.PANEL, corner_radius=14, border_width=1, border_color="#e5e7eb")
        body.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        queue_frame = ctk.CTkFrame(body, fg_color="#ffffff", corner_radius=12)
        queue_frame.pack(fill="both", expand=True, padx=10, pady=10)

        queue_title = ctk.CTkLabel(queue_frame, text="Очередь печати", text_color=self.TEXT)
        queue_title.pack(anchor="w", padx=12, pady=(10, 0))

        queue_container = ctk.CTkFrame(queue_frame, fg_color="transparent")
        queue_container.pack(fill="both", expand=True, padx=6, pady=10)

        self.queue_tree = ttk.Treeview(
            queue_container,
            columns=("job_id", "printer", "status", "message", "timestamp"),
            show="headings",
            selectmode="browse",
        )
        self.queue_tree.heading("job_id", text="Job ID")
        self.queue_tree.heading("printer", text="Printer")
        self.queue_tree.heading("status", text="Status")
        self.queue_tree.heading("message", text="Message")
        self.queue_tree.heading("timestamp", text="Timestamp")

        self.queue_tree.column("job_id", width=80)
        self.queue_tree.column("printer", width=200)
        self.queue_tree.column("status", width=100)
        self.queue_tree.column("message", width=320)
        self.queue_tree.column("timestamp", width=170)

        # Мягкие цвета (в том же духе, что акцент сайта).
        self.queue_tree.tag_configure("tag_pending", background="#fff7cc")   # soft yellow
        self.queue_tree.tag_configure("tag_printing", background="#e0f2fe")  # blue-100
        self.queue_tree.tag_configure("tag_success", background="#dcfce7")   # green-100
        self.queue_tree.tag_configure("tag_error", background="#fee2e2")     # red-100
        self.queue_tree.tag_configure("tag_unknown", background="")

        self.queue_tree_scroll = ttk.Scrollbar(queue_container, orient="vertical", command=self.queue_tree.yview)
        self.queue_tree.configure(yscrollcommand=self.queue_tree_scroll.set)
        self.queue_tree.pack(side="left", fill="both", expand=True)
        self.queue_tree_scroll.pack(side="right", fill="y")

    def _upsert_job_row(self, event: dict):
        job_id = event.get("job_id")
        job_id_str = _safe_str(job_id)

        # Если job_id не пришёл, просто добавляем новую строку
        if not job_id_str:
            self.local_unknown_job_counter += 1
            job_id_str = f"local-{self.local_unknown_job_counter}"

        values = (
            job_id_str,
            event.get("printer_name", ""),
            event.get("status", ""),
            event.get("message", ""),
            event.get("timestamp", ""),
        )

        tag = self._status_to_tag(event.get("status", ""))

        # Пытаемся найти существующую строку по job_id (первое вхождение).
        # Это сделает "pending -> printing -> success/error" читабельным.
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
            messagebox.showwarning("Missing data", "Введите `printer token` и `organization id`.")
            return

        if self.agent_thread and self.agent_thread.is_alive():
            messagebox.showinfo("Already running", "Агент уже запущен.")
            return

        def connection_cb(ev):
            self.events_q.put(("connection", ev))

        def job_cb(ev):
            self.events_q.put(("job", ev))

        # Сохраняем токен и org_id (чтобы не вводить заново)
        try:
            self._save_auth(token, org_id)
        except Exception as e:
            messagebox.showwarning("Warning", f"Не удалось сохранить токен/ID: {e}")

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
                self.events_q.put(("connection", {"status": "error", "message": str(e), "timestamp": datetime.now().isoformat()}))

        self.agent_thread = threading.Thread(target=run, daemon=True)
        self.agent_thread.start()

        self.connect_btn.configure(state="disabled")
        self.disconnect_btn.configure(state="normal")
        self.status_var.set("Starting agent...")
        self.status_badge.configure(fg_color="#e9f6ff", text_color="#0f172a")

    def _on_stop(self):
        if self.agent:
            try:
                self.agent.stop()
            except Exception:
                pass
        self.connect_btn.configure(state="normal")
        self.disconnect_btn.configure(state="disabled")
        self.status_var.set("Stopped")
        self.status_badge.configure(fg_color="#eef2ff", text_color="#1f2937")

    def _poll_events(self):
        try:
            while True:
                typ, payload = self.events_q.get_nowait()

                if typ == "connection":
                    status = payload.get("status", "")
                    msg = payload.get("message", "")
                    ts = payload.get("timestamp", "")
                    self.status_var.set(f"{status}: {msg} ({ts})")
                    # Меняем цвет бейджа под статус (чтобы быстрее считывать состояние)
                    s = (status or "").lower()
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

