from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.autoservice_finance import AutoserviceFinanceReceiptsResponse
from app.services.autoservice_payment_service import list_finance_receipts
from app.utils.autoservice_access import require_autoservice_staff

router = APIRouter(tags=["Autoservice finance"])


@router.get(
    "/autoservice/finance/receipts",
    response_model=AutoserviceFinanceReceiptsResponse,
)
def get_autoservice_finance_receipts(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    return list_finance_receipts(db, org_id=org_id, date_from=date_from, date_to=date_to)
