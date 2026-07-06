"""Вычисляемый прогресс онбординга продавца из данных БД."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.pending_product import PendingProduct
from app.models.printer_agent import PrinterAgent
from app.models.printer_agent_printer import PrinterAgentPrinter
from app.models.product import Product
from app.models.storage_cell import StorageCell
from app.models.storage_location import StorageLocation
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingProgressOut,
    OnboardingStepOut,
    SellerOnboardingResponse,
)

CORE_STEP_IDS = frozenset({
    "organization_profile",
    "storage_location",
    "first_part",
    "part_moderation",
})


def _step(
    step_id: str,
    title: str,
    *,
    hint: str,
    url: str,
    done: bool,
    required: bool,
) -> OnboardingStepOut:
    return OnboardingStepOut(
        id=step_id,
        title=title,
        hint=hint,
        url=url,
        status="done" if done else "pending",
        required=required,
    )


def get_seller_onboarding(db: Session, user: User) -> SellerOnboardingResponse:
    org_id = user.organization_id
    if not org_id:
        return SellerOnboardingResponse(
            steps=[],
            core_completed=False,
            core_progress=OnboardingProgressOut(done=0, total=len(CORE_STEP_IDS)),
            optional_pending=0,
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()

    phone_ok = bool(org and org.phone and str(org.phone).strip())
    description_ok = bool(org and org.description and str(org.description).strip())
    org_profile_done = phone_ok and description_ok

    storage_locations_count = (
        db.query(func.count(StorageLocation.id))
        .filter(StorageLocation.organization_id == org_id)
        .scalar()
        or 0
    )

    storage_cells_count = (
        db.query(func.count(StorageCell.id))
        .join(StorageLocation, StorageCell.storage_location_id == StorageLocation.id)
        .filter(StorageLocation.organization_id == org_id)
        .scalar()
        or 0
    )

    products_count = (
        db.query(func.count(Product.id))
        .filter(Product.organization_id == org_id)
        .scalar()
        or 0
    )

    pending_products_count = (
        db.query(func.count(PendingProduct.id))
        .filter(PendingProduct.organization_id == org_id)
        .scalar()
        or 0
    )

    parts_total = int(products_count) + int(pending_products_count)
    first_part_done = parts_total >= 1
    moderation_done = pending_products_count >= 1 or products_count >= 1

    printer_agents_count = (
        db.query(func.count(PrinterAgent.id))
        .filter(PrinterAgent.organization_id == org_id, PrinterAgent.is_active.is_(True))
        .scalar()
        or 0
    )

    printer_devices_count = (
        db.query(func.count(PrinterAgentPrinter.id))
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterAgent.organization_id == org_id)
        .scalar()
        or 0
    )
    print_done = printer_agents_count >= 1 or printer_devices_count >= 1

    avito_row = (
        db.query(OrganizationAvitoIntegration)
        .filter(OrganizationAvitoIntegration.organization_id == org_id)
        .first()
    )
    avito_done = bool(avito_row and avito_row.client_id and str(avito_row.client_id).strip())

    steps = [
        _step(
            "email_verified",
            "Email подтверждён",
            hint="Подтверждено при регистрации",
            url="/profile",
            done=True,
            required=False,
        ),
        _step(
            "organization_profile",
            "Профиль организации",
            hint="Укажите телефон и описание организации",
            url="/settings/organization",
            done=org_profile_done,
            required=True,
        ),
        _step(
            "seller_approved",
            "Одобрен админом",
            hint="Аккаунт продавца активирован",
            url="/dashboard",
            done=bool(user.is_seller or user.is_director),
            required=True,
        ),
        _step(
            "storage_location",
            "Склад добавлен",
            hint="Добавьте хотя бы один склад в настройках организации",
            url="/settings/organization",
            done=storage_locations_count >= 1,
            required=True,
        ),
        _step(
            "storage_cell",
            "Адресная ячейка",
            hint="Создайте ячейку для адресного хранения",
            url="/settings/storage-addresses",
            done=storage_cells_count >= 1,
            required=False,
        ),
        _step(
            "first_part",
            "Первая запчасть",
            hint="Добавьте запчасть в каталог",
            url="/my-parts/add",
            done=first_part_done,
            required=True,
        ),
        _step(
            "part_moderation",
            "Отправлено на модерацию",
            hint="Запчасть в очереди модерации или уже в каталоге",
            url="/my-parts?tab=pending",
            done=moderation_done,
            required=True,
        ),
        _step(
            "print_setup",
            "Печать этикеток",
            hint="Подключите агент печати и принтер",
            url="/settings/printers",
            done=print_done,
            required=False,
        ),
        _step(
            "avito_connected",
            "Avito подключён",
            hint="Настройте интеграцию с Avito",
            url="/settings/integration/avito",
            done=avito_done,
            required=False,
        ),
    ]

    core_done = sum(1 for s in steps if s.id in CORE_STEP_IDS and s.status == "done")
    core_completed = core_done >= len(CORE_STEP_IDS)
    optional_pending = sum(1 for s in steps if not s.required and s.status == "pending")

    return SellerOnboardingResponse(
        steps=steps,
        core_completed=core_completed,
        core_progress=OnboardingProgressOut(done=core_done, total=len(CORE_STEP_IDS)),
        optional_pending=optional_pending,
    )
