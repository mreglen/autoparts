from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardTasksResponse
from app.schemas.onboarding import SellerOnboardingResponse
from app.services.dashboard_tasks_service import get_dashboard_tasks
from app.services.seller_onboarding_service import get_seller_onboarding

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/tasks", response_model=DashboardTasksResponse)
def list_dashboard_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (current_user.is_admin or current_user.is_seller or current_user.is_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Дашборд доступен только продавцам и сотрудникам",
        )
    return get_dashboard_tasks(db, current_user)


@router.get("/onboarding", response_model=SellerOnboardingResponse)
def get_seller_onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (current_user.is_seller or current_user.is_director):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Онбординг доступен только продавцам",
        )
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У пользователя не указана организация",
        )
    return get_seller_onboarding(db, current_user)
