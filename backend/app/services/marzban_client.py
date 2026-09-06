"""Sync Marzban REST client for site admin VPN panel."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
ONLINE_WINDOW_SEC = 180


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return out
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def load_marzban_credentials() -> tuple[str, str, str]:
    base = (settings.MARZBAN_BASE_URL or "").strip().rstrip("/")
    user = (settings.MARZBAN_USERNAME or "").strip()
    password = (settings.MARZBAN_PASSWORD or "").strip()
    if not user or not password:
        env_path = Path(settings.MARZBAN_BOT_ENV_FILE or "/opt/marzban-vpn-bot/.env")
        file_env = _parse_env_file(env_path)
        base = base or file_env.get("MARZBAN_BASE_URL", "http://127.0.0.1:62050").rstrip("/")
        user = user or file_env.get("MARZBAN_USERNAME", "").strip()
        password = password or file_env.get("MARZBAN_PASSWORD", "").strip()
    if not base:
        base = "http://127.0.0.1:62050"
    if not user or not password:
        raise RuntimeError(
            "Marzban credentials missing (MARZBAN_USERNAME/PASSWORD or bot .env)"
        )
    return base, user, password


def public_subscription_url(url: str) -> str:
    url = (url or "").strip()
    for a, b in (
        ("://195.24.65.251:2086", "://svoygarage.ru"),
        ("://195.24.65.251:62050", "://svoygarage.ru"),
        ("http://svoygarage.ru", "https://svoygarage.ru"),
    ):
        if a in url:
            url = url.replace(a, b)
    return url


def build_happ_add_link(sub_url: str) -> str:
    sub = public_subscription_url(sub_url)
    if not sub.startswith("https://"):
        return sub
    return f"happ://add/{sub}"


def format_bytes(n: int | None) -> str:
    if n is None:
        return "—"
    n = int(n)
    if n < 1024:
        return f"{n} B"
    value = float(n)
    for unit in ("KB", "MB", "GB", "TB"):
        value /= 1024.0
        if value < 1024 or unit == "TB":
            return f"{value:.2f} {unit}"
    return f"{n} B"


def summarize_marzban_user(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {
            "available": False,
            "status": None,
            "used_traffic": None,
            "used_traffic_label": "—",
            "data_limit": None,
            "data_limit_label": "∞",
            "lifetime_used_traffic": None,
            "lifetime_used_traffic_label": "—",
            "online_at": None,
            "is_online": False,
            "subscription_url": None,
        }

    used = int(payload.get("used_traffic") or 0)
    limit = int(payload.get("data_limit") or 0)
    lifetime = int(payload.get("lifetime_used_traffic") or 0)
    online_raw = payload.get("online_at")
    online_at: datetime | None = None
    if isinstance(online_raw, str) and online_raw.strip():
        try:
            online_at = datetime.fromisoformat(online_raw.replace("Z", "+00:00"))
        except ValueError:
            online_at = None
    elif isinstance(online_raw, (int, float)) and online_raw:
        online_at = datetime.fromtimestamp(float(online_raw), tz=timezone.utc)

    is_online = False
    if online_at is not None:
        if online_at.tzinfo is None:
            online_at = online_at.replace(tzinfo=timezone.utc)
        is_online = (
            datetime.now(timezone.utc) - online_at
        ).total_seconds() <= ONLINE_WINDOW_SEC

    sub = payload.get("subscription_url")
    sub = public_subscription_url(sub) if isinstance(sub, str) else None

    return {
        "available": True,
        "status": str(payload.get("status") or "") or None,
        "used_traffic": used,
        "used_traffic_label": format_bytes(used),
        "data_limit": limit,
        "data_limit_label": "∞" if limit <= 0 else format_bytes(limit),
        "lifetime_used_traffic": lifetime,
        "lifetime_used_traffic_label": format_bytes(lifetime),
        "online_at": online_at,
        "is_online": is_online,
        "subscription_url": sub,
    }


class MarzbanSyncClient:
    def __init__(self) -> None:
        base, user, password = load_marzban_credentials()
        self._username = user
        self._password = password
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._client = httpx.Client(base_url=base, timeout=30.0)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "MarzbanSyncClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def _get_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_expires_at:
            return self._token
        response = self._client.post(
            "/api/admin/token",
            data={"username": self._username, "password": self._password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Marzban auth failed (HTTP {response.status_code})")
        token = response.json().get("access_token")
        if not token:
            raise RuntimeError("Marzban did not return access_token")
        self._token = token
        self._token_expires_at = now + 50 * 60
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> httpx.Response:
        token = self._get_token()
        response = self._client.request(
            method,
            path,
            json=json_body,
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            self._token = None
            token = self._get_token()
            response = self._client.request(
                method,
                path,
                json=json_body,
                headers={"Authorization": f"Bearer {token}"},
            )
        return response

    def get_user(self, username: str) -> dict[str, Any] | None:
        response = self._request("GET", f"/api/user/{username}")
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise RuntimeError(f"Marzban get_user failed (HTTP {response.status_code})")
        return response.json()

    def modify_user(self, username: str, patch: dict[str, Any]) -> dict[str, Any]:
        response = self._request("PUT", f"/api/user/{username}", json_body=patch)
        if response.status_code != 200:
            raise RuntimeError(
                f"Marzban modify_user failed (HTTP {response.status_code}): {response.text[:200]}"
            )
        return response.json()

    def disable_user(self, username: str) -> dict[str, Any]:
        return self.modify_user(username, {"status": "disabled"})

    def activate_user(self, username: str, *, expire_at: datetime) -> dict[str, Any]:
        return self.modify_user(
            username,
            {"status": "active", "expire": int(expire_at.timestamp())},
        )

    def revoke_sub(self, username: str) -> dict[str, Any]:
        response = self._request("POST", f"/api/user/{username}/revoke_sub")
        if response.status_code != 200:
            raise RuntimeError(
                f"Marzban revoke_sub failed (HTTP {response.status_code}): {response.text[:200]}"
            )
        return response.json()

    def reset_traffic(self, username: str) -> dict[str, Any]:
        response = self._request("POST", f"/api/user/{username}/reset")
        if response.status_code != 200:
            raise RuntimeError(
                f"Marzban reset traffic failed (HTTP {response.status_code}): {response.text[:200]}"
            )
        return response.json()


def try_get_marzban_summary(username: str) -> dict[str, Any]:
    try:
        with MarzbanSyncClient() as client:
            return summarize_marzban_user(client.get_user(username))
    except Exception as exc:
        logger.warning("Marzban summary failed for %s: %s", username, exc)
        return {**summarize_marzban_user(None), "error": str(exc)}
