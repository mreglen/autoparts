from sqlalchemy.orm import Session
from app.models.event_log import EventLog
import json

def log_event(db: Session, event_type: str, user_id: int = None, email: str = None, details: dict = None):
    log_entry = EventLog(
        event_type=event_type,
        user_id=user_id,
        email=email,
        details=json.dumps(details, ensure_ascii=False) if details else None
    )
    db.add(log_entry)
    db.commit()