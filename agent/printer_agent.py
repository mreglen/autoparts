import asyncio
import json
import websockets
import socket
import win32print
import win32ui
import win32con
from datetime import datetime
import sys
import base64

import fitz
from PIL import Image, ImageWin

class PrinterAgent:
    def __init__(
        self,
        # server_uri="wss://svoygarage.ru/server/api/printers/ws",
        server_uri="ws://127.0.0.1:8000/api/printers/ws",
        auth_token=None,
        organization_id=None,
        on_printers_updated=None,
        on_connection_updated=None,
        on_job_updated=None,
    ):
        self.server_uri = server_uri
        self.auth_token = auth_token  # This is now the printer_token
        self.organization_id = organization_id
        self.websocket = None
        self.running = False

        # UI callbacks (по желанию)
        # Формат on_printers_updated: printers[list[dict]]
        # Формат on_connection_updated: event[dict]
        # Формат on_job_updated: event[dict]
        self.on_printers_updated = on_printers_updated
        self.on_connection_updated = on_connection_updated
        self.on_job_updated = on_job_updated
        self.loop = None
        
        # Если токен не передан, пробуем получить из аргументов командной строки
        if not auth_token and len(sys.argv) > 1:
            self.auth_token = sys.argv[1]
        
        # Если ID организации не передан, пробуем получить из аргументов
        if not organization_id and len(sys.argv) > 2:
            self.organization_id = sys.argv[2]
        
    def get_available_printers(self):
        """Get list of all available printers on the system"""
        printers = []
        try:
            # Get all printers
            printer_list = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            
            for printer_info in printer_list:
                printer_name = printer_info[2]  # Printer name is at index 2
                
                try:
                    # Open printer to get more details
                    h_printer = win32print.OpenPrinter(printer_name)
                    if h_printer:
                        printer_details = win32print.GetPrinter(h_printer, 2)
                        win32print.ClosePrinter(h_printer)
                        
                        printers.append({
                            "name": printer_name,
                            "driver_name": printer_details.get("pDriverName", "Unknown"),
                            "port_name": printer_details.get("pPortName", "Unknown"),
                            "status": "ready",
                            "default": printer_name == win32print.GetDefaultPrinter()
                        })
                except Exception as e:
                    printers.append({
                        "name": printer_name,
                        "driver_name": "Unknown",
                        "port_name": "Unknown",
                        "status": "error",
                        "default": printer_name == win32print.GetDefaultPrinter(),
                        "error": str(e)
                    })
                    
        except Exception as e:
            print(f"Error getting printers: {e}")
            
        return printers
    
    async def connect(self):
        """Connect to WebSocket server with reconnection logic"""
        while self.running:
            try:
                # Добавляем токен принтера и ID организации в заголовки
                headers = {}
                if self.auth_token:
                    headers["X-Printer-Token"] = self.auth_token
                if self.organization_id:
                    headers["X-Organization-ID"] = self.organization_id
                
                if self.on_connection_updated:
                    self.on_connection_updated({
                        "status": "connecting",
                        "message": f"Attempting to connect to {self.server_uri}...",
                        "timestamp": datetime.now().isoformat()
                    })

                print(f"Attempting to connect to {self.server_uri}...")
                if self.auth_token and self.organization_id:
                    print(f"Using printer token for organization: {self.organization_id}")
                else:
                    print("WARNING: No authentication credentials provided!")
                    print("Run with: python printer_agent.py YOUR_PRINTER_TOKEN YOUR_ORGANIZATION_ID")
                
                self.websocket = await websockets.connect(
                    self.server_uri,
                    extra_headers=headers if headers else None,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=10
                )
                print("Connected to server!")

                if self.on_connection_updated:
                    self.on_connection_updated({
                        "status": "connected",
                        "message": "WebSocket connected",
                        "timestamp": datetime.now().isoformat()
                    })
                
                # Send initial printer list
                await self.send_printer_list()
                
                # Listen for messages
                await self.listen()
                
            except websockets.exceptions.ConnectionClosedError as e:
                print(f"Connection closed: {e}, reconnecting in 5 seconds...")
                if self.on_connection_updated:
                    self.on_connection_updated({
                        "status": "disconnected",
                        "message": f"Connection closed: {e}. Reconnecting...",
                        "timestamp": datetime.now().isoformat()
                    })
                await asyncio.sleep(5)
            except websockets.exceptions.InvalidStatusCode as e:
                if e.status_code == 401:
                    print(f"Authentication failed (HTTP 401): Invalid or missing printer token")
                    print("Please provide a valid printer token and organization ID")
                    print("\nTo get your printer token:")
                    print("1. Login to the application as organization admin")
                    print("2. Go to Organization Settings")
                    print("3. Find 'Receipt Printing' section")
                    print("4. Click 'Generate Printer Token'")
                    print("5. Copy the token and your organization ID")
                    print("\nExample: python printer_agent.py your_token_here your_org_id")
                    print("\nWaiting 30 seconds before retry...")

                    if self.on_connection_updated:
                        self.on_connection_updated({
                            "status": "auth_error",
                            "message": "Invalid printer token or organization ID (HTTP 401)",
                            "timestamp": datetime.now().isoformat()
                        })
                    await asyncio.sleep(30)
                else:
                    print(f"Connection error: HTTP {e.status_code}, retrying in 5 seconds...")
                    if self.on_connection_updated:
                        self.on_connection_updated({
                            "status": "error",
                            "message": f"Connection error: HTTP {e.status_code}",
                            "timestamp": datetime.now().isoformat()
                        })
                    await asyncio.sleep(5)
            except ConnectionRefusedError:
                print("Connection refused, retrying in 5 seconds...")
                if self.on_connection_updated:
                    self.on_connection_updated({
                        "status": "error",
                        "message": "Connection refused",
                        "timestamp": datetime.now().isoformat()
                    })
                await asyncio.sleep(5)
            except Exception as e:
                print(f"Connection error: {e}, retrying in 5 seconds...")
                if self.on_connection_updated:
                    self.on_connection_updated({
                        "status": "error",
                        "message": f"{e}",
                        "timestamp": datetime.now().isoformat()
                    })
                await asyncio.sleep(5)
    
    async def send_printer_list(self):
        """Send current printer list to server"""
        if self.websocket:
            try:
                printers = self.get_available_printers()
                message = {
                    "type": "printer_list",
                    "data": {
                        "printers": printers,
                        "timestamp": datetime.now().isoformat(),
                        "hostname": socket.gethostname()
                    }
                }
                await self.websocket.send(json.dumps(message))
                print(f"Sent printer list: {len(printers)} printers found")

                if self.on_printers_updated:
                    self.on_printers_updated(printers)
            except Exception as e:
                print(f"Error sending printer list: {e}")
    
    async def handle_print_command(self, data):
        """Handle print command from server"""
        try:
            printer_name = data.get("printer_name")
            content = data.get("content", "")
            copies = int(data.get("copies", 1))

            # На backend очередь обновляется по job_id, поэтому обязательно прокидываем его дальше
            job_id = data.get("job_id")
            try:
                job_id_int = int(job_id) if job_id is not None else None
            except Exception:
                job_id_int = None
            
            print(f"Printing to {printer_name}: {copies} copy(ies)")
            
            if not printer_name:
                print("No printer specified, using default")
                printer_name = win32print.GetDefaultPrinter()

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int,
                    "printer_name": printer_name,
                    "copies": copies,
                    "status": "pending",
                    "message": "Queued",
                    "timestamp": datetime.now().isoformat()
                })

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int,
                    "printer_name": printer_name,
                    "copies": copies,
                    "status": "printing",
                    "message": "Printing...",
                    "timestamp": datetime.now().isoformat()
                })
            
            def _print_text_via_gdi(target_printer: str, text: str, copies_count: int = 1) -> None:
                """
                Печать обычного текста через GDI (драйвер Windows).
                Это важно для XP-365B: такие драйверы могут "принять" RAW/TEXT, но не печатать физически.
                """
                lines = (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
                if not lines:
                    lines = [""]

                def wrap_no_spaces(s: str, dc_obj, max_width: int) -> list[str]:
                    """Жесткий перенос без пробелов (если длинные строки обрезаются)."""
                    out: list[str] = []
                    current = ""
                    for ch in s:
                        cand = current + ch
                        w, _ = dc_obj.GetTextExtent(cand)
                        if w <= max_width:
                            current = cand
                        else:
                            if current:
                                out.append(current)
                            current = ch
                    if current:
                        out.append(current)
                    return out or [""]

                for _ in range(max(1, int(copies_count or 1))):
                    dc = win32ui.CreateDC()
                    dc.CreatePrinterDC(target_printer)

                    # На некоторых драйверах координаты не "в пикселях" как ожидается,
                    # но старт вблизи (0,0) обычно безопаснее, чем большие отступы.
                    x0 = 10
                    y0 = 10

                    max_width = max(100, dc.GetDeviceCaps(win32con.HORZRES) - 20)

                    # Выбираем шрифт
                    log_y = dc.GetDeviceCaps(win32con.LOGPIXELSY) or 96
                    font_height = int(-10 * log_y / 72)  # ~10pt
                    try:
                        font = win32ui.CreateFont(
                            {
                                "name": "Consolas",
                                "height": font_height,
                                "weight": win32con.FW_NORMAL,
                            }
                        )
                        dc.SelectObject(font)
                    except Exception:
                        pass

                    dc.SetTextColor(0x000000)
                    try:
                        dc.SetBkMode(win32con.TRANSPARENT)
                    except Exception:
                        pass

                    _, text_h = dc.GetTextExtent("Hg")
                    line_h = max(14, text_h + 4)

                    def wrap_line(s: str) -> list[str]:
                        if not s:
                            return [""]
                        if " " not in s:
                            return wrap_no_spaces(s, dc, max_width)

                        parts = s.split(" ")
                        out: list[str] = []
                        current = ""
                        for part in parts:
                            sep = " " if current else ""
                            cand = current + sep + part
                            w, _ = dc.GetTextExtent(cand)
                            if w <= max_width:
                                current = cand
                            else:
                                if current:
                                    out.append(current)
                                w_part, _ = dc.GetTextExtent(part)
                                if w_part <= max_width:
                                    current = part
                                else:
                                    out.extend(wrap_no_spaces(part, dc, max_width))
                                    current = ""
                        if current:
                            out.append(current)
                        return out or [""]

                    dc.StartDoc("AutoParts Receipt")
                    dc.StartPage()

                    y = y0
                    for raw_line in lines:
                        for line in wrap_line(raw_line):
                            dc.TextOut(x0, y, line)
                            y += line_h

                    dc.EndPage()
                    dc.EndDoc()
                    dc.DeleteDC()

            # Open printer
            h_printer = win32print.OpenPrinter(printer_name)
            
            if h_printer:
                # Для XP-365B корректнее печатать
                # обычный текст через GDI, иначе RAW может "успешно" отправляться,
                # но физически ничего не выходить.
                pn = (printer_name or "").lower().replace(" ", "")
                if "xprinter" in pn and ("xp-365b" in pn or "xp365b" in pn):
                    try:
                        print("Using GDI print path for XP-365B...")
                        _print_text_via_gdi(printer_name, content, copies)
                        win32print.ClosePrinter(h_printer)
                        h_printer = None
                        job_sent = True
                    except Exception as e:
                        # Если GDI не сработал — откатываемся на старый RAW/TEXT путь.
                        print(f"GDI print failed, falling back to RAW/TEXT: {e}")
                        job_sent = False

                if h_printer is None:
                    # Уже напечатали через GDI и закрыли handle.
                    pass
                else:
                    # Определяем тип контента:
                    # Если контент содержит ESC/POS команды (контрольные байты < 32),
                    # то логично печатать как RAW.
                    # Если ESC нет — большинство драйверов принимает TEXT,
                    # но некоторые (например XP-365B) не принимают TEXT как datatype.
                    has_esc_commands = any(ord(c) < 32 for c in content if c not in "\n\r\t")

                    try:
                        encoded_content = content.encode("cp1251", errors="replace")
                    except Exception:
                        encoded_content = content.encode("utf-8", errors="replace")

                    # Порядок проб:
                    # - если ESC есть: первично RAW, иначе TEXT
                    # - если первичный datatype не принимается драйвером — пробуем альтернативный
                    if has_esc_commands:
                        datatype_candidates = ["RAW", "TEXT"]
                    else:
                        datatype_candidates = ["TEXT", "RAW"]

                    job_sent = False
                    last_print_error = None

                    for idx, datatype in enumerate(datatype_candidates):
                        is_last_candidate = idx == (len(datatype_candidates) - 1)
                        job_info = (
                            "AutoParts Receipt",  # pDocName
                            None,                 # pOutputFile
                            datatype,             # pDatatype
                        )
                        doc_started = False
                        page_started = False
                        try:
                            print(f"Starting print job with datatype: {datatype}")
                            h_job = win32print.StartDocPrinter(h_printer, 1, job_info)

                            if h_job <= 0:
                                last_print_error = RuntimeError(
                                    f"StartDocPrinter returned {h_job} for datatype={datatype}"
                                )
                                continue

                            doc_started = True
                            win32print.StartPagePrinter(h_printer)
                            page_started = True
                            bytes_written = win32print.WritePrinter(h_printer, encoded_content)
                            print(f"Sent {bytes_written} bytes to printer")
                            print(f"Content preview: {content[:100]}...")

                            win32print.EndPagePrinter(h_printer)
                            win32print.EndDocPrinter(h_printer)
                            print("Print job sent successfully")
                            job_sent = True
                            break
                        except Exception as e:
                            # Для некоторых принтеров драйвер отклоняет TEXT datatype (например 1804).
                            # В таком случае пробуем альтернативный datatype.
                            last_print_error = e
                            if is_last_candidate:
                                print(f"Failed to start/print with datatype={datatype}: {e}")
                            else:
                                # Чтобы не пугать "ошибкой" пользователя: это ожидаемый fallback.
                                print(f"StartDocPrinter not supported for datatype={datatype}, trying next...")
                            # Если документ успел стартовать, стараемся его корректно закрыть,
                            # чтобы следующий retry не мешал текущему драйверу.
                            if page_started:
                                try:
                                    win32print.EndPagePrinter(h_printer)
                                except Exception:
                                    pass
                            if doc_started:
                                try:
                                    win32print.EndDocPrinter(h_printer)
                                except Exception:
                                    pass

                    if not job_sent and last_print_error is not None:
                        raise last_print_error

                    win32print.ClosePrinter(h_printer)
            
            # Send confirmation back
            if self.websocket:
                await self.websocket.send(json.dumps({
                    "type": "print_status",
                    "data": {
                        "job_id": job_id_int,
                        "status": "success",
                        "message": f"Print job sent to {printer_name}",
                        "timestamp": datetime.now().isoformat()
                    }
                }))

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int,
                    "printer_name": printer_name,
                    "copies": copies,
                    "status": "success",
                    "message": f"Printed x{copies}",
                    "timestamp": datetime.now().isoformat()
                })
                
        except Exception as e:
            print(f"Print error: {e}")
            if self.websocket:
                await self.websocket.send(json.dumps({
                    "type": "print_status",
                    "data": {
                        "job_id": job_id_int if 'job_id_int' in locals() else None,
                        "status": "error",
                        "message": str(e),
                        "timestamp": datetime.now().isoformat()
                    }
                }))

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int if 'job_id_int' in locals() else None,
                    "printer_name": data.get("printer_name"),
                    "copies": int(data.get("copies", 1)),
                    "status": "error",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat()
                })

    async def handle_print_pdf_command(self, data):
        """Handle PDF print command from server (base64-encoded PDF)."""
        try:
            printer_name = data.get("printer_name")
            pdf_b64 = data.get("pdf_base64") or ""
            copies = int(data.get("copies", 1))

            job_id = data.get("job_id")
            try:
                job_id_int = int(job_id) if job_id is not None else None
            except Exception:
                job_id_int = None

            if not printer_name:
                printer_name = win32print.GetDefaultPrinter()

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int,
                    "printer_name": printer_name,
                    "copies": copies,
                    "status": "printing",
                    "message": "Printing PDF...",
                    "timestamp": datetime.now().isoformat()
                })

            pdf_bytes = base64.b64decode(pdf_b64)
            # Save PDF to temporary file and open it
            import tempfile
            import os
            
            temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
            try:
                with os.fdopen(temp_fd, 'wb') as f:
                    f.write(pdf_bytes)
                
                doc = fitz.open(temp_path)
                if doc.page_count < 1:
                    raise RuntimeError("Empty PDF")

                page = doc.load_page(0)
                # 203 DPI is common for label printers
                pix = page.get_pixmap(dpi=203, alpha=False)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                doc.close()
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass

            def _print_image_via_gdi(target_printer: str, pil_img: Image.Image, copies_count: int = 1) -> None:
                """
                Print image with correct scaling to fit the printable area.
                PDF is already in landscape orientation from the generator.
                Accounts for printer margins and physical printable area.
                """
                for _ in range(max(1, int(copies_count or 1))):
                    dc = win32ui.CreateDC()
                    dc.CreatePrinterDC(target_printer)

                    # Get physical device dimensions
                    page_w = dc.GetDeviceCaps(win32con.HORZRES)  # Printable width
                    page_h = dc.GetDeviceCaps(win32con.VERTRES)  # Printable height
                    
                    # Get physical offset (margins)
                    phys_offset_x = dc.GetDeviceCaps(win32con.PHYSICALOFFSETX)
                    phys_offset_y = dc.GetDeviceCaps(win32con.PHYSICALOFFSETY)
                    
                    # Image dimensions
                    img_width, img_height = pil_img.size
                    
                    # PDF is already in landscape orientation, no need to rotate
                    img_to_print = pil_img
                    
                    # Calculate aspect ratios
                    page_aspect = page_w / page_h
                    img_aspect = img_width / img_height
                    
                    # Fit image while preserving aspect ratio - SCALE TO FIT PRINTABLE AREA
                    # Ensure the entire label fits within the printable area with margins
                    if img_aspect > page_aspect:
                        # Image is wider - fit to width
                        draw_w = page_w
                        draw_h = int(page_w / img_aspect)
                        x_offset = phys_offset_x
                        y_offset = phys_offset_y + (page_h - draw_h) // 2
                    else:
                        # Image is taller - fit to height
                        draw_h = page_h
                        draw_w = int(page_h * img_aspect)
                        x_offset = phys_offset_x + (page_w - draw_w) // 2
                        y_offset = phys_offset_y

                    dc.StartDoc("AutoParts Label (PDF)")
                    dc.StartPage()

                    # Draw image centered in printable area
                    dib = ImageWin.Dib(img_to_print.convert("RGB"))
                    dib.draw(dc.GetHandleOutput(), (x_offset, y_offset, x_offset + draw_w, y_offset + draw_h))

                    dc.EndPage()
                    dc.EndDoc()
                    dc.DeleteDC()

            _print_image_via_gdi(printer_name, img, copies)

            # Send confirmation back
            if self.websocket:
                await self.websocket.send(json.dumps({
                    "type": "print_status",
                    "data": {
                        "job_id": job_id_int,
                        "status": "success",
                        "message": f"PDF printed to {printer_name}",
                        "timestamp": datetime.now().isoformat()
                    }
                }))

            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int,
                    "printer_name": printer_name,
                    "copies": copies,
                    "status": "success",
                    "message": f"Printed PDF x{copies}",
                    "timestamp": datetime.now().isoformat()
                })
        except Exception as e:
            if self.websocket:
                await self.websocket.send(json.dumps({
                    "type": "print_status",
                    "data": {
                        "job_id": job_id_int if 'job_id_int' in locals() else None,
                        "status": "error",
                        "message": str(e),
                        "timestamp": datetime.now().isoformat()
                    }
                }))
            if self.on_job_updated:
                self.on_job_updated({
                    "type": "job_update",
                    "job_id": job_id_int if 'job_id_int' in locals() else None,
                    "printer_name": data.get("printer_name"),
                    "copies": int(data.get("copies", 1)),
                    "status": "error",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat()
                })
    
    async def listen(self):
        """Listen for incoming messages from server"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")
                    
                    print(f"Received message type: {msg_type}")
                    
                    if msg_type == "get_printers":
                        # Server requesting updated printer list
                        await self.send_printer_list()
                        
                    elif msg_type == "print":
                        # Server sending print command
                        await self.handle_print_command(data.get("data", {}))
                    elif msg_type == "print_pdf":
                        await self.handle_print_pdf_command(data.get("data", {}))
                        
                    elif msg_type == "ping":
                        # Heartbeat
                        await self.websocket.send(json.dumps({"type": "pong"}))
                        
                except json.JSONDecodeError:
                    print(f"Invalid JSON received: {message}")
                except Exception as e:
                    print(f"Error processing message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
            raise
    
    async def run(self):
        """Main run method"""
        self.running = True
        self.loop = asyncio.get_running_loop()
        print("Printer Agent started")
        print(f"Hostname: {socket.gethostname()}")
        
        # Show available printers
        printers = self.get_available_printers()
        print(f"Found {len(printers)} printer(s):")
        for printer in printers:
            default_marker = " [DEFAULT]" if printer["default"] else ""
            print(f"  - {printer['name']}{default_marker}")
        
        await self.connect()
    
    def stop(self):
        """Stop the agent"""
        self.running = False
        if self.websocket and self.loop:
            # Важно: закрываем websocket из того же event loop, где он создан
            try:
                asyncio.run_coroutine_threadsafe(self.websocket.close(), self.loop)
            except Exception:
                pass

async def main():
    agent = PrinterAgent()
    
    try:
        await agent.run()
    except KeyboardInterrupt:
        print("\nShutting down...")
        agent.stop()

if __name__ == "__main__":
    asyncio.run(main())
