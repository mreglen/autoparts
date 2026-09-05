#!/usr/bin/env python3
"""
Диагностика и авто-исправление VLESS-Reality в Marzban.

Проверяет:
  - dest / serverNames (SNI) — замена на TSPU-устойчивые (apple/icloud)
  - publicKey / shortIds согласованы с Host Settings и ссылками
  - address в Hosts = публичный IP (не localhost)
  - fingerprint=chrome, spiderX=/
  - ссылки подписки содержат pbk, sid, sni, корректный адрес

Запуск на master:
  python3 fix-reality-inbounds.py
  # или:
  MARZBAN_BASE_URL=http://127.0.0.1:62050 \\
  MARZBAN_USERNAME=admin MARZBAN_PASSWORD=... \\
  MASTER_IP=195.24.65.251 GERMANY_IP=212.102.227.25 \\
  python3 fix-reality-inbounds.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE = os.getenv("MARZBAN_BASE_URL", "http://127.0.0.1:62050").rstrip("/")
USER = os.getenv("MARZBAN_USERNAME", "admin")
PASS = os.getenv("MARZBAN_PASSWORD", "")
MASTER_IP = os.getenv("MASTER_IP", "195.24.65.251")
GERMANY_IP = os.getenv("GERMANY_IP", "212.102.227.25")
INBOUND_TAG = os.getenv("INBOUND_TAG", "VLESS TCP REALITY")

# Рабочие SNI под РФ (не Google/CF/часто-блокируемый Microsoft)
DEST_HOST = os.getenv("REALITY_DEST_HOST", "www.apple.com")
SERVER_NAMES = [
    s.strip()
    for s in os.getenv("REALITY_SERVER_NAMES", "www.apple.com,apple.com").split(",")
    if s.strip()
]
FINGERPRINT = os.getenv("REALITY_FINGERPRINT", "chrome")
SPIDER_X = os.getenv("REALITY_SPIDER_X", "/")

PUB_KEY_FILE = Path(os.getenv("REALITY_PUB_KEY_FILE", "/root/marzban-vpn-reality-public.key"))
SID_FILE = Path(os.getenv("REALITY_SID_FILE", "/root/marzban-vpn-reality-shortid.txt"))


class Marzban:
    def __init__(self) -> None:
        self.token = ""

    def _req(
        self,
        method: str,
        path: str,
        body: Any | None = None,
    ) -> Any:
        data = None
        headers: dict[str, str] = {}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(
            f"{BASE}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            err = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path} → HTTP {exc.code}: {err[:400]}") from exc

    def login(self) -> None:
        password = PASS
        if not password and Path("/root/marzban-vpn-admin.pass").is_file():
            password = Path("/root/marzban-vpn-admin.pass").read_text().strip()
        if not password:
            raise RuntimeError("Задайте MARZBAN_PASSWORD или /root/marzban-vpn-admin.pass")

        data = urllib.parse.urlencode(
            {"username": USER, "password": password}
        ).encode()
        req = urllib.request.Request(
            f"{BASE}/api/admin/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode())
        self.token = payload["access_token"]
        print("[ok] auth")

    def get_core(self) -> dict:
        return self._req("GET", "/api/core/config")

    def put_core(self, cfg: dict) -> None:
        self._req("PUT", "/api/core/config", cfg)
        print("[ok] core config updated (xray restart)")

    def get_hosts(self) -> dict:
        return self._req("GET", "/api/hosts")

    def put_hosts(self, hosts: dict) -> None:
        self._req("PUT", "/api/hosts", hosts)
        print("[ok] hosts updated")

    def get_user(self, username: str) -> dict:
        return self._req("GET", f"/api/user/{username}")

    def list_users(self, limit: int = 20) -> list[dict]:
        data = self._req("GET", f"/api/users?limit={limit}") or {}
        return list(data.get("users") or [])


def parse_vless(link: str) -> dict[str, str]:
    if not link.startswith("vless://"):
        return {}
    main, _frag = (link.split("#", 1) + [""])[:2]
    hostport = main.split("@", 1)[-1].split("?", 1)[0]
    q = main.split("?", 1)[1] if "?" in main else ""
    params = {k: v[0] for k, v in urllib.parse.parse_qs(q).items()}
    params["_address"] = hostport
    return params


def expected_pub_sid() -> tuple[str, str]:
    pub = PUB_KEY_FILE.read_text().strip() if PUB_KEY_FILE.is_file() else ""
    sid = SID_FILE.read_text().strip() if SID_FILE.is_file() else ""
    return pub, sid


def fix_inbound_reality(cfg: dict) -> tuple[dict, bool]:
    changed = False
    pub_file, sid_file = expected_pub_sid()

    for ib in cfg.get("inbounds") or []:
        if ib.get("tag") != INBOUND_TAG:
            continue
        stream = ib.setdefault("streamSettings", {})
        stream["network"] = "tcp"
        stream["security"] = "reality"
        reality = stream.setdefault("realitySettings", {})

        new_dest = f"{DEST_HOST}:443"
        if reality.get("dest") != new_dest:
            print(f"[fix] dest {reality.get('dest')} → {new_dest}")
            reality["dest"] = new_dest
            changed = True

        if reality.get("serverNames") != SERVER_NAMES:
            print(f"[fix] serverNames {reality.get('serverNames')} → {SERVER_NAMES}")
            reality["serverNames"] = list(SERVER_NAMES)
            changed = True

        if reality.get("fingerprint") != FINGERPRINT:
            print(f"[fix] fingerprint → {FINGERPRINT}")
            reality["fingerprint"] = FINGERPRINT
            changed = True

        if reality.get("spiderX") != SPIDER_X:
            print(f"[fix] spiderX → {SPIDER_X!r}")
            reality["spiderX"] = SPIDER_X
            changed = True

        short_ids = reality.get("shortIds") or []
        if sid_file and (not short_ids or short_ids[0] != sid_file):
            print(f"[fix] shortIds → [{sid_file}]")
            reality["shortIds"] = [sid_file]
            changed = True

        # publicKey в core часто вычисляется из privateKey; если пусто — подставим из файла
        if pub_file and not reality.get("publicKey"):
            reality["publicKey"] = pub_file
            changed = True
            print(f"[fix] publicKey set from file ({pub_file[:12]}…)")

        if not reality.get("privateKey"):
            raise RuntimeError("privateKey отсутствует в inbound — нельзя чинить вслепую")

        print(
            "[info] inbound OK candidate:",
            f"dest={reality.get('dest')}",
            f"sni={reality.get('serverNames')}",
            f"sid={reality.get('shortIds')}",
            f"pbk={(reality.get('publicKey') or '')[:16]}…",
            f"fp={reality.get('fingerprint')}",
            f"spx={reality.get('spiderX')!r}",
        )
    return cfg, changed


def fix_hosts(hosts: dict, pub: str, sid: str) -> tuple[dict, bool]:
    changed = False
    entries = list(hosts.get(INBOUND_TAG) or [])
    if not entries:
        # создать оба хоста с нуля
        entries = [
            {
                "remark": "🇷🇺 Russia | VLESS-Reality",
                "address": MASTER_IP,
                "port": 8443,
            },
            {
                "remark": "🇩🇪 Germany | VLESS-Reality",
                "address": GERMANY_IP,
                "port": 8443,
            },
        ]
        changed = True
        print("[fix] hosts were empty — creating Russia + Germany")

    fixed: list[dict] = []
    for h in entries:
        h = dict(h)
        addr = str(h.get("address") or "")
        if addr in {"127.0.0.1", "localhost", "0.0.0.0", ""}:
            # эвристика по remark
            remark = str(h.get("remark") or "")
            if "Germany" in remark or "🇩🇪" in remark:
                h["address"] = GERMANY_IP
            else:
                h["address"] = MASTER_IP
            print(f"[fix] host address {addr!r} → {h['address']}")
            changed = True

        if int(h.get("port") or 0) != 8443:
            h["port"] = 8443
            changed = True
            print("[fix] host port → 8443")

        if h.get("sni") != DEST_HOST:
            print(f"[fix] host sni {h.get('sni')} → {DEST_HOST}")
            h["sni"] = DEST_HOST
            changed = True

        if h.get("fingerprint") != FINGERPRINT:
            h["fingerprint"] = FINGERPRINT
            changed = True

        # path в Host Settings Marzban часто мапится в spx для Reality
        if h.get("path") != SPIDER_X:
            h["path"] = SPIDER_X
            changed = True

        h["security"] = h.get("security") or "inbound_default"
        h["host"] = h.get("host") or ""
        h["alpn"] = h.get("alpn") or ""
        h["allowinsecure"] = False
        h["is_disabled"] = False
        h.setdefault("mux_enable", False)
        h.setdefault("fragment_setting", "")
        h.setdefault("noise_setting", "")
        h.setdefault("random_user_agent", False)
        h.setdefault("use_sni_as_host", False)
        fixed.append(h)

    # гарантируем оба IP
    addrs = {str(h.get("address")) for h in fixed}
    if MASTER_IP not in addrs:
        fixed.insert(
            0,
            {
                "remark": "🇷🇺 Russia | VLESS-Reality",
                "address": MASTER_IP,
                "port": 8443,
                "sni": DEST_HOST,
                "host": "",
                "path": SPIDER_X,
                "security": "inbound_default",
                "alpn": "",
                "fingerprint": FINGERPRINT,
                "allowinsecure": False,
                "is_disabled": False,
                "mux_enable": False,
                "fragment_setting": "",
                "noise_setting": "",
                "random_user_agent": False,
                "use_sni_as_host": False,
            },
        )
        changed = True
        print("[fix] added missing Russia host")
    if GERMANY_IP not in addrs:
        fixed.append(
            {
                "remark": "🇩🇪 Germany | VLESS-Reality",
                "address": GERMANY_IP,
                "port": 8443,
                "sni": DEST_HOST,
                "host": "",
                "path": SPIDER_X,
                "security": "inbound_default",
                "alpn": "",
                "fingerprint": FINGERPRINT,
                "allowinsecure": False,
                "is_disabled": False,
                "mux_enable": False,
                "fragment_setting": "",
                "noise_setting": "",
                "random_user_agent": False,
                "use_sni_as_host": False,
            }
        )
        changed = True
        print("[fix] added missing Germany host")

    hosts[INBOUND_TAG] = fixed
    print(f"[info] expected pbk={pub[:16]}… sid={sid}")
    return hosts, changed


def verify_links(api: Marzban, pub: str, sid: str) -> list[str]:
    problems: list[str] = []
    users = api.list_users(limit=5)
    if not users:
        print("[warn] нет пользователей для проверки ссылок")
        return problems

    for u in users[:3]:
        username = u.get("username")
        full = api.get_user(username)
        links = full.get("links") or []
        print(f"[check] user={username} links={len(links)}")
        for link in links:
            p = parse_vless(link)
            addr = p.get("_address", "")
            print(f"  {addr} sni={p.get('sni')} fp={p.get('fp')} pbk={(p.get('pbk') or '')[:12]}… sid={p.get('sid')}")
            if not addr or addr.startswith("127.") or "localhost" in addr:
                problems.append(f"{username}: bad address {addr}")
            if p.get("security") != "reality":
                problems.append(f"{username}: security≠reality")
            if pub and p.get("pbk") != pub:
                problems.append(f"{username}: pbk mismatch")
            if sid and p.get("sid") != sid:
                problems.append(f"{username}: sid mismatch")
            if p.get("sni") != DEST_HOST:
                problems.append(f"{username}: sni={p.get('sni')} expected {DEST_HOST}")
            if p.get("fp") != FINGERPRINT:
                problems.append(f"{username}: fp={p.get('fp')} expected {FINGERPRINT}")
            if SPIDER_X and p.get("spx") not in (None, "", SPIDER_X):
                # spx может отсутствовать — не ошибка; если есть — должен совпасть
                if p.get("spx") != SPIDER_X.lstrip("/"):
                    pass
    return problems


def main() -> int:
    api = Marzban()
    api.login()

    pub, sid = expected_pub_sid()
    core = api.get_core()
    # достанем pbk/sid из core если файлов нет
    for ib in core.get("inbounds") or []:
        if ib.get("tag") != INBOUND_TAG:
            continue
        r = (ib.get("streamSettings") or {}).get("realitySettings") or {}
        pub = pub or (r.get("publicKey") or "")
        sids = r.get("shortIds") or []
        sid = sid or (sids[0] if sids else "")

    core, core_changed = fix_inbound_reality(core)
    if core_changed:
        api.put_core(core)
    else:
        print("[ok] core reality already healthy")

    hosts = api.get_hosts()
    hosts, hosts_changed = fix_hosts(hosts, pub, sid)
    if hosts_changed:
        api.put_hosts(hosts)
    else:
        print("[ok] hosts already healthy")

    # после обновления hosts — перечитаем sample links
    problems = verify_links(api, pub, sid)
    if problems:
        print("[fail] link issues:")
        for p in problems:
            print(" -", p)
        return 1

    print("[done] Reality inbound/hosts look good.")
    print("Клиентам: обновить подписку в Happ (кнопка Обновить).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("[error]", exc, file=sys.stderr)
        raise SystemExit(2)
