"""Seed a fully populated TEST autoservice organization (isolated demo data).

Run on the server from backend/:
    venv/bin/python scripts/seed_test_autoservice.py

Creates a separate organization with is_autoservice=True, one director user
and >=3 rows in every autoservice entity. Idempotent-ish: aborts if the test
org/user already exists.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_contractor import AutoserviceContractor
from app.models.autoservice_document_buyer import AutoserviceDocumentBuyer
from app.models.autoservice_expense import AutoserviceExpense, AutoserviceExpenseArticle
from app.models.autoservice_payment import AutoservicePayment
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.autoservice_settings import AutoserviceSettings
from app.models.autoservice_warehouse import (
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
)
from app.models.autoservice_work import AutoserviceWork
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.models.employee_work_zone import EmployeeWorkZone
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.organization import Organization
from app.models.organization_employee import (
    OrganizationEmployee,
    OrganizationEmployeePayrollTerm,
)
from app.models.repair_booking import RepairBooking
from app.models.repair_order import (
    RepairOrder,
    RepairOrderClientPart,
    RepairOrderShopPart,
    RepairOrderWork,
)
from app.models.user import User
from app.services.autoservice_counters import (
    COUNTER_AUTOSERVICE_PAYMENT,
    COUNTER_REPAIR_ORDER,
    next_counter_value,
)
from app.services.organization_employee_sync import (
    get_or_create_card_for_user,
    link_service_employee_card,
    sync_user_service_executor,
)
from app.utils.id_generator import random_id
from app.utils.user_public_code import assign_public_code

ORG_NAME = "Тестовый автосервис DEMO"
USER_EMAIL = "test.autoservice@svoygarage.ru"
USER_PASSWORD = "Test1234!"


def main() -> None:
    db = SessionLocal()
    try:
        existing_org = (
            db.query(Organization).filter(Organization.name == ORG_NAME).first()
        )
        existing_user = db.query(User).filter(User.email == USER_EMAIL).first()
        if existing_org or existing_user:
            print("ABORT: test org or user already exists")
            print(f"  org: {existing_org.id if existing_org else '-'} {ORG_NAME}")
            print(f"  user: {existing_user.id if existing_user else '-'} {USER_EMAIL}")
            return

        # --- Organization + settings ---
        org_id = random_id(10)
        while db.query(Organization).filter(Organization.id == org_id).first():
            org_id = random_id(10)
        org = Organization(
            id=org_id,
            name=ORG_NAME,
            address="г. Екатеринбург, ул. Тестовая, 1",
            phone="+73430000001",
            legal_name="ООО «Тестовый автосервис DEMO»",
            legal_address="г. Екатеринбург, ул. Тестовая, 1",
            inn="6670000001",
            kpp="667001001",
            ogrn="1236600000001",
            director_name="Тестов Тест Тестович",
            description="Тестовая организация автосервиса для проверки кабинета.",
            is_autoservice=True,
            autoservice_paused=False,
        )
        db.add(org)
        db.flush()
        db.add(
            AutoserviceSettings(
                organization_id=org.id,
                public_name=ORG_NAME,
                public_description=org.description,
                lifts_count=3,
            )
        )

        # --- Director user ---
        user = User(
            last_name="Тестов",
            first_name="Автосервис",
            patronymic="Демо",
            email=USER_EMAIL,
            phone="+79000000001",
            is_director=True,
            organization_id=org.id,
            hashed_password=get_password_hash(USER_PASSWORD),
        )
        assign_public_code(user, db)
        db.add(user)
        db.flush()

        # Director employee card + legacy service employee
        card = sync_user_service_executor(
            db, user, enabled=True, work_percent=Decimal("50")
        )
        db.add(
            OrganizationEmployeePayrollTerm(
                organization_employee_id=card.id,
                salary_type="percent_work",
                salary_amount=Decimal("0"),
                work_percent=Decimal("50"),
                effective_from=date.today(),
            )
        )

        # --- Employees: 2 more cards + service employees ---
        employees = [card]
        for i, (ln, fn, pos, pct) in enumerate(
            [
                ("Иванов", "Иван", "Механик", Decimal("40")),
                ("Петров", "Пётр", "Электрик", Decimal("45")),
            ],
            start=2,
        ):
            svc = AutoserviceServiceEmployee(
                organization_id=org.id,
                name=f"{ln} {fn}"[:120],
                phone=f"+790000000{i}1",
                position=pos,
                salary_type="percent_work",
                work_percent=pct,
            )
            db.add(svc)
            db.flush()
            emp_card = link_service_employee_card(db, svc)
            employees.append(emp_card)

        # one more legacy service employee without payroll link is covered by
        # link_service_employee_card; add third service employee explicitly
        svc3 = AutoserviceServiceEmployee(
            organization_id=org.id,
            name="Сидоров Сидор",
            phone="+79000000041",
            position="Кузовщик",
            salary_type="fixed",
            salary_amount=Decimal("80000"),
        )
        db.add(svc3)
        db.flush()
        employees.append(link_service_employee_card(db, svc3))

        # --- Work zones ---
        zones = []
        for i, zname in enumerate(["Подъёмник 1", "Подъёмник 2", "Яма"], start=1):
            z = AutoserviceWorkZone(
                organization_id=org.id, name=zname, sort_order=i
            )
            db.add(z)
            db.flush()
            zones.append(z)
        for emp, z in zip(employees, zones):
            db.add(
                EmployeeWorkZone(
                    organization_employee_id=emp.id,
                    work_zone_id=z.id,
                    can_view=True,
                    can_edit=True,
                    can_caldav=False,
                )
            )

        # --- Catalog works ---
        works = []
        for i, (wname, price) in enumerate(
            [
                ("Замена моторного масла", Decimal("1500")),
                ("Диагностика ходовой части", Decimal("2000")),
                ("Замена тормозных колодок", Decimal("2500")),
            ],
            start=1,
        ):
            w = AutoserviceWork(
                organization_id=org.id,
                name=wname,
                default_unit_price=price,
                sort_order=i,
            )
            db.add(w)
            db.flush()
            works.append(w)

        # --- Clients ---
        clients = []
        client_data = [
            ("Иванов Иван Иванович", "+79001110001", "individual", None),
            ("ООО «Рога и копыта»", "+79001110002", "legal", "6671111111"),
            ("Сидорова Анна", "+79001110003", "individual", None),
        ]
        for name, phone, ptype, inn in client_data:
            c = AutoserviceClient(
                organization_id=org.id,
                name=name,
                phone=phone,
                person_type=ptype,
                legal_name=name if ptype == "legal" else None,
                inn=inn,
                status="active",
                source="staff",
                consented_at=datetime.utcnow(),
                created_by_user_id=user.id,
            )
            db.add(c)
            db.flush()
            clients.append(c)

        # --- Vehicles ---
        vehicles = []
        for c, (make, model, year, plate) in zip(
            clients,
            [
                ("BMW", "X5", 2019, "А123ВС66"),
                ("Toyota", "Camry", 2021, "В456ОР66"),
                ("Lada", "Vesta", 2022, "Е789ТХ66"),
            ],
        ):
            v = GarageVehicle(
                client_id=c.id,
                organization_id=org.id,
                make=make,
                model=model,
                year=year,
                plate=plate,
                vin=None,
                mileage_km=45000 + c.id * 1000,
                source="manual",
            )
            db.add(v)
            db.flush()
            vehicles.append(v)

        # --- Warehouse items + receipt doc ---
        items = []
        wh_data = [
            ("Bosch", "0W-20-5W30", "Масло моторное 5W-30", 4, Decimal("1800")),
            ("Mann-Filter", "W712/75", "Фильтр масляный", 10, Decimal("650")),
            ("ATE", "13.0460.10.70", "Колодки тормозные передние", 6, Decimal("3200")),
        ]
        for brand, article, name, qty, price in wh_data:
            it = AutoserviceWarehouseItem(
                organization_id=org.id,
                brand=brand,
                article=article,
                name=name,
                quantity=0,
                unit="pcs",
                unit_price=price,
            )
            db.add(it)
            db.flush()
            items.append((it, qty))

        doc = AutoserviceWarehouseReceiptDoc(
            organization_id=org.id,
            number="ТН-0001",
            supplier_kind="manual",
            supplier_name="ООО «ТестПоставщик»",
            created_by=user.id,
        )
        db.add(doc)
        db.flush()
        for it, qty in items:
            db.add(
                AutoserviceWarehouseReceipt(
                    organization_id=org.id,
                    document_id=doc.id,
                    item_id=it.id,
                    quantity=qty,
                    unit_price=it.unit_price,
                    created_by=user.id,
                )
            )
            it.quantity = qty

        # --- Contractors ---
        for i, (cname, cphone) in enumerate(
            [
                ("Кузовной цех «Вектор»", "+79002220001"),
                ("Шиномонтаж «Колесо»", "+79002220002"),
                ("Электрик ИП Самодюк", "+79002220003"),
            ],
            start=1,
        ):
            db.add(
                AutoserviceContractor(
                    organization_id=org.id,
                    name=cname,
                    phone=cphone,
                    salary_type="percent_work",
                    work_percent=Decimal("30"),
                )
            )

        # --- Document buyers ---
        for i, bname in enumerate(
            [
                "ООО «АвтоДилер Север»",
                "ИП Кузнецов А.В.",
                "ООО «ТрансСервис»",
            ],
            start=1,
        ):
            db.add(
                AutoserviceDocumentBuyer(
                    organization_id=org.id,
                    name=bname,
                    address="г. Екатеринбург",
                    inn=f"66722222{i:02d}",
                )
            )

        # --- Repair orders ---
        now = datetime.utcnow()
        order_statuses = ["pending", "in_progress", "completed"]
        orders = []
        for idx, status in enumerate(order_statuses):
            order = RepairOrder(
                organization_id=org.id,
                order_number=str(next_counter_value(db, org.id, COUNTER_REPAIR_ORDER)),
                client_id=clients[idx].id,
                vehicle_id=vehicles[idx].id,
                scheduled_at=now + timedelta(days=idx),
                scheduled_end_at=now + timedelta(days=idx, hours=3),
                accepted_by_user_id=user.id,
                created_by_user_id=user.id,
                status=status,
                work_zone_id=zones[idx].id,
                client_comment="Тестовый заказ-наряд",
                mileage_km=vehicles[idx].mileage_km,
                status_completed_at=(now if status == "completed" else None),
            )
            db.add(order)
            db.flush()
            orders.append(order)

            # works (2 per order)
            for pos, w in enumerate(works[:2], start=1):
                db.add(
                    RepairOrderWork(
                        order_id=order.id,
                        position=pos,
                        catalog_work_id=w.id,
                        title=w.name,
                        qty=1,
                        unit_price=w.default_unit_price,
                        executor_user_id=user.id,
                    )
                )
            # client part
            db.add(
                RepairOrderClientPart(
                    order_id=order.id,
                    position=1,
                    title="Фильтр салонный (клиент)",
                    qty=1,
                    unit="pcs",
                )
            )
            # shop parts: one linked to autoservice stock
            if idx == 0:
                db.add(
                    RepairOrderShopPart(
                        order_id=order.id,
                        position=1,
                        title=items[0][0].name,
                        qty=Decimal("1"),
                        unit="pcs",
                        unit_price=items[0][0].unit_price,
                        source="autoservice_stock",
                        autoservice_stock_item_id=items[0][0].id,
                        brand=items[0][0].brand,
                        partnumber=items[0][0].article,
                    )
                )
            else:
                db.add(
                    RepairOrderShopPart(
                        order_id=order.id,
                        position=1,
                        title="Свеча зажигания",
                        qty=Decimal("4"),
                        unit="pcs",
                        unit_price=Decimal("900"),
                        source="manual",
                    )
                )
            order.employee_assignees = [employees[0]]

        # --- Payments ---
        methods = ["card", "cash", "bank"]
        for idx, order in enumerate(orders):
            db.add(
                AutoservicePayment(
                    organization_id=org.id,
                    repair_order_id=order.id,
                    sequential_number=next_counter_value(
                        db, org.id, COUNTER_AUTOSERVICE_PAYMENT
                    ),
                    method=methods[idx],
                    amount=Decimal("5000"),
                    created_by_user_id=user.id,
                    paid_at=now,
                )
            )

        # --- Expense articles + expenses ---
        articles = []
        for i, aname in enumerate(["Запчасти", "Зарплата", "Хозрасходы"], start=1):
            a = AutoserviceExpenseArticle(
                organization_id=org.id, name=aname
            )
            db.add(a)
            db.flush()
            articles.append(a)
        for idx, a in enumerate(articles):
            db.add(
                AutoserviceExpense(
                    organization_id=org.id,
                    type="salary" if idx == 1 else "other",
                    article_id=a.id,
                    amount=Decimal("10000") * (idx + 1),
                    expense_date=now,
                    description=f"Тестовый расход #{idx + 1}",
                    employee_id=(employees[idx].legacy_service_employee_id or None),
                    created_by_user_id=user.id,
                )
            )

        # --- Inspection bookings ---
        for idx in range(3):
            db.add(
                InspectionBooking(
                    organization_id=org.id,
                    client_id=clients[idx].id,
                    garage_vehicle_id=vehicles[idx].id,
                    name=clients[idx].name[:120],
                    phone=clients[idx].phone,
                    preferred_date=date.today() + timedelta(days=idx + 1),
                    preferred_time=time(10 + idx, 0),
                    vehicle_make=vehicles[idx].make,
                    vehicle_model=vehicles[idx].model,
                    status="new",
                    source="staff",
                    created_by_user_id=user.id,
                    work_zone_id=zones[idx].id,
                    notes="Тестовая запись на осмотр",
                )
            )

        # --- Repair bookings (legacy) ---
        for idx in range(3):
            db.add(
                RepairBooking(
                    organization_id=org.id,
                    client_id=clients[idx].id,
                    garage_vehicle_id=vehicles[idx].id,
                    name=clients[idx].name[:120],
                    phone=clients[idx].phone,
                    preferred_date=date.today() + timedelta(days=idx + 2),
                    comment="Тестовая заявка на ремонт",
                    status="new",
                    source="staff",
                    created_by_user_id=user.id,
                )
            )

        db.commit()

        # Organization chat (best-effort, mirrors registration flow)
        try:
            from app.services.organization_chat_service import (
                on_user_joined_organization,
            )

            on_user_joined_organization(db, user)
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"WARN: org chat bootstrap skipped: {exc}")

        print("OK")
        print(f"organization_id: {org.id}")
        print(f"user_id:         {user.id}")
        print(f"email:           {USER_EMAIL}")
        print(f"password:        {USER_PASSWORD}")
        print(f"org_name:        {ORG_NAME}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
