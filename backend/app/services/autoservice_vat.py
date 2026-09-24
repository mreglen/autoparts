from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.autoservice_settings import AutoserviceSettings
from app.models.repair_order import RepairOrder
from app.schemas.repair_order import HISTORY_STATUSES

DEFAULT_VAT_RATE = Decimal("22")


def get_org_vat_rate(db: Session, org_id: str) -> Decimal:
    row = (
        db.query(AutoserviceSettings.vat_rate)
        .filter(AutoserviceSettings.organization_id == org_id)
        .first()
    )
    if row and row[0] is not None:
        return Decimal(str(row[0]))
    return DEFAULT_VAT_RATE


def apply_vat_rate_to_open_orders(db: Session, org_id: str, vat_rate: Decimal) -> int:
    """Re-snapshot vat_rate on orders that are not closed (completed/cancelled keep theirs)."""
    return (
        db.query(RepairOrder)
        .filter(
            RepairOrder.organization_id == org_id,
            ~RepairOrder.status.in_(HISTORY_STATUSES),
        )
        .update({"vat_rate": vat_rate}, synchronize_session=False)
    )
