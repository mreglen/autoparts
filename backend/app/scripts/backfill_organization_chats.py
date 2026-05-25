"""
Backfill organization group chats for all existing organizations.

Run: python -m app.scripts.backfill_organization_chats
"""
import logging

from app.db.database import SessionLocal
from app.services.organization_chat_service import backfill_all_organization_chats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    db = SessionLocal()
    try:
        backfill_all_organization_chats(db)
        logger.info("Organization group chats backfill finished successfully")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
