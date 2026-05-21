from sqlalchemy.orm import Session

from app.services.audit_service import log_audit


def log_event(
    db: Session,
    event_type: str,
    user_id: int = None,
    email: str = None,
    details: dict = None,
):
    """Backward-compatible wrapper; maps legacy calls to audit service."""
    category = "auth"
    if event_type.startswith("seller_"):
        category = "moderation"
    elif event_type == "employee_created":
        category = "employees"
    org_id = None
    if details and isinstance(details, dict):
        org_id = details.get("organization_id")

    summary = event_type.replace("_", " ")
    log_audit(
        db,
        event_type=event_type,
        category=category,
        summary=summary,
        user_id=user_id,
        email=email,
        organization_id=org_id,
        details=details,
    )
