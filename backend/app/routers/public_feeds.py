from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.services.yandex_feed_xml_service import generate_used_yml_feed

router = APIRouter(prefix="/feeds", tags=["Public feeds"])


@router.get("/yandex/used.yml")
def public_yandex_used_feed(db: Session = Depends(get_db)):
    row = get_or_create_yandex_integration(db)
    payload = generate_used_yml_feed(
        db,
        preferred_host_url=row.host_url,
        condition_type=row.used_condition_type,
        condition_reason=row.used_condition_reason,
    )
    return Response(content=payload.xml, media_type="application/xml")
