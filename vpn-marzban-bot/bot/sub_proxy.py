#!/usr/bin/env python3
"""Local /sub/ normalizer proxy for Happ VPN.

Fetches Marzban subscription, strips empty VLESS query params, sanitizes
remarks, re-encodes as standard base64 text/plain with Happ-friendly headers.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from aiohttp import ClientSession, web

# Allow importing happ_crypto from bot dir when installed under /opt
BOT_DIR = Path(__file__).resolve().parent
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

from happ_crypto import normalize_subscription_body  # noqa: E402

MARZBAN_SUB_UPSTREAM = os.getenv(
    "MARZBAN_SUB_UPSTREAM", "http://127.0.0.1:62050"
).rstrip("/")
LISTEN_HOST = os.getenv("SUB_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.getenv("SUB_PROXY_PORT", "62060"))
SUPPORT_TG_URL = os.getenv(
    "HAPP_SUPPORT_URL", "https://t.me/marzvpn_bot"
).strip()


async def handle_sub(request: web.Request) -> web.StreamResponse:
    token = request.match_info.get("token", "").strip()
    if not token or "/" in token or ".." in token:
        return web.Response(status=400, text="bad token")

    upstream = f"{MARZBAN_SUB_UPSTREAM}/sub/{token}"
    headers_in = {
        "User-Agent": request.headers.get("User-Agent", "Happ/3.5.0"),
        "Accept": "*/*",
    }
    async with ClientSession() as session:
        async with session.get(upstream, headers=headers_in, timeout=15) as resp:
            raw = await resp.read()
            if resp.status != 200:
                return web.Response(
                    status=resp.status,
                    body=raw,
                    content_type=resp.content_type or "text/plain",
                )
            pass_headers = {}
            for h in (
                "subscription-userinfo",
                "profile-title",
                "content-disposition",
            ):
                if h in resp.headers:
                    pass_headers[h] = resp.headers[h]

    try:
        body = normalize_subscription_body(raw)
    except Exception:
        body = raw

    # Иконка Telegram в Happ → бот @marzvpn_bot
    pass_headers.update(
        {
            "Content-Type": "text/plain; charset=utf-8",
            "profile-update-interval": "24",
            "Cache-Control": "no-store",
            "profile-title": "base64:U3ZveUdhcmFnZSBWUE4=",  # SvoyGarage VPN
            "support-url": SUPPORT_TG_URL,
            "profile-web-page-url": SUPPORT_TG_URL,
            "announce": SUPPORT_TG_URL,
        }
    )
    return web.Response(body=body, headers=pass_headers)


def main() -> None:
    app = web.Application()
    app.router.add_get("/sub/{token}", handle_sub)
    app.router.add_get("/sub/{token}/", handle_sub)
    web.run_app(app, host=LISTEN_HOST, port=LISTEN_PORT, print=None)


if __name__ == "__main__":
    main()
