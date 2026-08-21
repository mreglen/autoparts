#!/usr/bin/env python3
"""One-off: find and purge a user and related records by email/phone."""
from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env")

EMAIL = "jivddahuqunzpxj-35463@24.email"
PHONE_TAIL = "1233333366"


def _run(conn, stmt: str, params: dict | None = None) -> None:
    conn.execute(text("SAVEPOINT purge_step"))
    try:
        conn.execute(text(stmt), params or {})
        conn.execute(text("RELEASE SAVEPOINT purge_step"))
    except Exception as exc:
        conn.execute(text("ROLLBACK TO SAVEPOINT purge_step"))
        msg = str(exc).lower()
        if "does not exist" in msg or "undefinedtable" in msg:
            print(f"SKIP missing table: {stmt.split()[2]}")
            return
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--email", default=EMAIL)
    parser.add_argument("--phone-tail", default=PHONE_TAIL)
    args = parser.parse_args()

    url = os.getenv("DATABASE_URL_DIRECT") or os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    engine = create_engine(url)

    with engine.connect() as conn:
        users = conn.execute(
            text(
                """
                SELECT id, email, phone, first_name, last_name, organization_id, public_code
                FROM users
                WHERE lower(email) = lower(:email)
                   OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                """
            ),
            {"email": args.email, "phone_tail": args.phone_tail},
        ).fetchall()
        print(f"Found {len(users)} user(s)")
        for row in users:
            print(dict(row._mapping))

        if not args.apply:
            cards = conn.execute(
                text(
                    """
                    SELECT id, user_id, email, phone FROM organization_employees
                    WHERE lower(coalesce(email, '')) = lower(:email)
                       OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                    """
                ),
                {"email": args.email, "phone_tail": args.phone_tail},
            ).fetchall()
            print(f"Found {len(cards)} organization_employee card(s)")
            for row in cards:
                print(dict(row._mapping))
            svc = conn.execute(
                text(
                    """
                    SELECT id, name, phone FROM autoservice_service_employees
                    WHERE right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                    """
                ),
                {"phone_tail": args.phone_tail},
            ).fetchall()
            print(f"Found {len(svc)} service employee(s)")
            for row in svc:
                print(dict(row._mapping))

    user_ids = [row.id for row in users]
    if not user_ids and not args.apply:
        print("Nothing to delete")
        return 0

    if not args.apply:
        print("DRY RUN — pass --apply to delete")
        return 0

    with engine.begin() as conn:
        for uid in user_ids:
            print(f"Deleting user_id={uid} ...")
            _purge_user(conn, uid)

        cards = conn.execute(
            text(
                """
                SELECT id, legacy_service_employee_id FROM organization_employees
                WHERE lower(coalesce(email, '')) = lower(:email)
                   OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                """
            ),
            {"email": args.email, "phone_tail": args.phone_tail},
        ).fetchall()
        for card in cards:
            _purge_org_employee_card(conn, card.id, card.legacy_service_employee_id)

        svc_rows = conn.execute(
            text(
                """
                SELECT id FROM autoservice_service_employees
                WHERE right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                """
            ),
            {"phone_tail": args.phone_tail},
        ).fetchall()
        for row in svc_rows:
            _purge_service_employee(conn, row.id)

        client_rows = conn.execute(
            text(
                """
                SELECT id FROM autoservice_clients
                WHERE lower(coalesce(email, '')) = lower(:email)
                   OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = :phone_tail
                   OR user_id = ANY(:user_ids)
                """
            ),
            {"email": args.email, "phone_tail": args.phone_tail, "user_ids": user_ids or [-1]},
        ).fetchall()
        for row in client_rows:
            _run(conn, "DELETE FROM autoservice_clients WHERE id = :id", {"id": row.id})
            print(f"Deleted autoservice_client id={row.id}")

    print("DONE")
    return 0


def _purge_org_employee_card(conn, card_id: int, legacy_service_employee_id: int | None) -> None:
    for stmt in [
        "DELETE FROM organization_employee_permissions WHERE organization_employee_id = :id",
        "DELETE FROM organization_employee_payroll_terms WHERE organization_employee_id = :id",
        "DELETE FROM organization_employee_timesheet_entries WHERE organization_employee_id = :id",
        "DELETE FROM organization_employee_account_invites WHERE organization_employee_id = :id",
        "DELETE FROM organization_employees WHERE id = :id",
    ]:
        _run(conn, stmt, {"id": card_id})
    print(f"Deleted organization_employee id={card_id}")
    if legacy_service_employee_id:
        _purge_service_employee(conn, legacy_service_employee_id)


def _purge_service_employee(conn, service_employee_id: int) -> None:
    _run(conn, "DELETE FROM autoservice_payroll_accruals WHERE employee_id = :id", {"id": service_employee_id})
    _run(conn, "DELETE FROM repair_order_work_executors WHERE employee_id = :id", {"id": service_employee_id})
    _run(conn, "DELETE FROM autoservice_service_employees WHERE id = :id", {"id": service_employee_id})
    print(f"Deleted autoservice_service_employee id={service_employee_id}")


def _purge_user(conn, uid: int) -> None:
    cards = conn.execute(
        text("SELECT id, legacy_service_employee_id FROM organization_employees WHERE user_id = :uid"),
        {"uid": uid},
    ).fetchall()
    for card in cards:
        _purge_org_employee_card(conn, card.id, card.legacy_service_employee_id)

    for stmt in [
        "DELETE FROM chat_blocked_users WHERE blocked_user_id = :uid OR blocked_by_id = :uid",
        "DELETE FROM chat_participants WHERE user_id = :uid",
        "DELETE FROM messages WHERE sender_id = :uid",
        "UPDATE chats SET buyer_id = NULL WHERE buyer_id = :uid",
        "UPDATE chats SET seller_id = NULL WHERE seller_id = :uid",
        "UPDATE chats SET created_by_id = NULL WHERE created_by_id = :uid",
        "DELETE FROM user_favorites WHERE user_id = :uid",
        "DELETE FROM user_rossko_favorites WHERE user_id = :uid",
        "DELETE FROM user_product_views WHERE user_id = :uid",
        "DELETE FROM search_subscriptions WHERE user_id = :uid",
        "DELETE FROM push_subscriptions WHERE user_id = :uid",
        "DELETE FROM user_permissions WHERE user_id = :uid",
        "DELETE FROM user_sessions WHERE user_id = :uid",
        "DELETE FROM printer_permissions WHERE user_id = :uid",
        "DELETE FROM push_subscriptions WHERE user_id = :uid",
        "DELETE FROM new_parts_cart WHERE user_id = :uid OR cart_id IN (SELECT id FROM carts WHERE user_id = :uid)",
        "DELETE FROM used_parts_cart WHERE user_id = :uid OR cart_id IN (SELECT id FROM carts WHERE user_id = :uid)",
        "DELETE FROM new_parts_baskets WHERE cart_id IN (SELECT id FROM carts WHERE user_id = :uid)",
        "DELETE FROM carts WHERE user_id = :uid",
        "DELETE FROM stock_out WHERE user_id = :uid",
        "UPDATE products SET created_by = NULL WHERE created_by = :uid",
        "UPDATE pending_products SET created_by = NULL WHERE created_by = :uid",
        "UPDATE rejected_products SET created_by = NULL WHERE created_by = :uid",
        "UPDATE stock_in SET created_by = NULL WHERE created_by = :uid",
        "UPDATE site_reviews SET user_id = NULL WHERE user_id = :uid",
        "DELETE FROM repair_order_assignees WHERE user_id = :uid",
        "UPDATE repair_orders SET accepted_by_user_id = NULL WHERE accepted_by_user_id = :uid",
        "UPDATE repair_orders SET created_by_user_id = NULL WHERE created_by_user_id = :uid",
        "UPDATE repair_order_works SET executor_user_id = NULL WHERE executor_user_id = :uid",
        "UPDATE autoservice_clients SET user_id = NULL WHERE user_id = :uid",
        "UPDATE autoservice_clients SET created_by_user_id = NULL WHERE created_by_user_id = :uid",
        "UPDATE autoservice_payments SET created_by_user_id = NULL WHERE created_by_user_id = :uid",
        "DELETE FROM users WHERE id = :uid",
    ]:
        _run(conn, stmt, {"uid": uid})

    print(f"Deleted user id={uid}")


if __name__ == "__main__":
    raise SystemExit(main())
