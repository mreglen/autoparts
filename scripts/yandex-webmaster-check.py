#!/usr/bin/env python3
"""Manual checks for Yandex Webmaster API (user, hosts, verification, feeds)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any

API_BASE = "https://api.webmaster.yandex.net/v4"
DEFAULT_HOST_ID = "https:svoygarage.ru:443"
DEFAULT_FEED_URL = "https://svoygarage.ru/api/feeds/yandex/used.yml"


def _request(
    method: str,
    path: str,
    token: str,
    *,
    body: dict | None = None,
) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "Authorization": f"OAuth {token}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json;charset=UTF-8"

    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            parsed = {"error_message": payload}
        code = parsed.get("error_code") or parsed.get("error")
        message = parsed.get("error_message") or parsed.get("error_description") or payload
        raise RuntimeError(f"HTTP {exc.code}: {code or 'ERROR'} — {message}") from exc


def cmd_check(token: str, host_id: str) -> int:
    print("=== GET /user ===")
    user = _request("GET", "/user", token)
    print(json.dumps(user, ensure_ascii=False, indent=2))
    user_id = int(user["user_id"])

    print("\n=== GET /user/{user-id}/hosts ===")
    hosts = _request("GET", f"/user/{user_id}/hosts", token)
    print(json.dumps(hosts, ensure_ascii=False, indent=2))

    print(f"\n=== GET /verification ({host_id}) ===")
    verification = _request("GET", f"/user/{user_id}/hosts/{host_id}/verification", token)
    print(json.dumps(verification, ensure_ascii=False, indent=2))

    print(f"\n=== GET /feeds/list ({host_id}) ===")
    feeds = _request("GET", f"/user/{user_id}/hosts/{host_id}/feeds/list", token)
    print(json.dumps(feeds, ensure_ascii=False, indent=2))

    verified = verification.get("verification_state") == "VERIFIED"
    print("\nSummary:")
    print(f"  user_id: {user_id}")
    print(f"  host_id: {host_id}")
    print(f"  verified: {verified}")
    print(f"  feeds_count: {len(feeds.get('feeds') or [])}")
    return 0 if verified else 1


def cmd_sync(
    token: str,
    host_id: str,
    feed_url: str,
    feed_type: str,
    region_ids: list[int],
    poll_seconds: int,
    poll_interval: int,
) -> int:
    user_id = int(_request("GET", "/user", token)["user_id"])
    verification = _request("GET", f"/user/{user_id}/hosts/{host_id}/verification", token)
    if verification.get("verification_state") != "VERIFIED":
        raise RuntimeError("Host is not verified. Confirm rights in Webmaster first.")

    print("=== POST /feeds/add/start ===")
    start = _request(
        "POST",
        f"/user/{user_id}/hosts/{host_id}/feeds/add/start",
        token,
        body={"feed": {"url": feed_url, "type": feed_type, "regionIds": region_ids}},
    )
    print(json.dumps(start, ensure_ascii=False, indent=2))
    request_id = str(start.get("requestId") or "").strip()
    if not request_id:
        raise RuntimeError("Yandex did not return requestId")

    deadline = time.time() + poll_seconds
    process_status = "IN_PROGRESS"
    print(f"\n=== GET /feeds/add/info (requestId={request_id}) ===")
    while time.time() < deadline:
        info = _request(
            "GET",
            f"/user/{user_id}/hosts/{host_id}/feeds/add/info",
            token,
            body={"requestId": request_id},
        )
        process_status = str(info.get("processStatus") or "").upper()
        print(json.dumps(info, ensure_ascii=False))
        if process_status in {"OK", "FAILED", "ERROR"}:
            break
        time.sleep(poll_interval)

    print("\n=== GET /feeds/list ===")
    feeds = _request("GET", f"/user/{user_id}/hosts/{host_id}/feeds/list", token)
    print(json.dumps(feeds, ensure_ascii=False, indent=2))

    if process_status != "OK":
        print(f"\nSync finished with status: {process_status or 'UNKNOWN'}")
        return 1

    print("\nSync finished successfully (processStatus=OK)")
    return 0


def _parse_region_ids(raw: str) -> list[int]:
    out: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        out.append(int(part))
    return out or [225]


def main() -> int:
    parser = argparse.ArgumentParser(description="Yandex Webmaster API manual checker")
    parser.add_argument(
        "--token",
        default=os.getenv("YANDEX_OAUTH_TOKEN", "").strip(),
        help="OAuth access token (or env YANDEX_OAUTH_TOKEN)",
    )
    parser.add_argument("--host-id", default=DEFAULT_HOST_ID)
    parser.add_argument("--feed-url", default=DEFAULT_FEED_URL)
    parser.add_argument("--feed-type", default="GOODS")
    parser.add_argument("--region-ids", default="225", help="Comma-separated region IDs")
    parser.add_argument("--poll-seconds", type=int, default=180)
    parser.add_argument("--poll-interval", type=int, default=5)

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check", help="Check user, hosts, verification and feeds list")
    sub.add_parser("sync", help="Start async feed upload and poll status")

    args = parser.parse_args()
    if not args.token:
        print("Error: pass --token or set YANDEX_OAUTH_TOKEN", file=sys.stderr)
        return 2

    try:
        if args.command == "check":
            return cmd_check(args.token, args.host_id)
        if args.command == "sync":
            return cmd_sync(
                args.token,
                args.host_id,
                args.feed_url,
                args.feed_type,
                _parse_region_ids(args.region_ids),
                args.poll_seconds,
                args.poll_interval,
            )
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
