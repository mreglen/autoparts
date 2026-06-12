from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.seo_pipeline_state import SeoPipelineState

_PIPELINE_STATE_ID = 1


def get_or_create_pipeline_state(db: Session) -> SeoPipelineState:
    row = db.query(SeoPipelineState).filter(SeoPipelineState.id == _PIPELINE_STATE_ID).first()
    if row is None:
        row = SeoPipelineState(
            id=_PIPELINE_STATE_ID,
            tecdoc_direct_cursor=0,
            tecdoc_cross_cursor=0,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_tecdoc_direct_cursor(db: Session) -> int:
    return int(get_or_create_pipeline_state(db).tecdoc_direct_cursor or 0)


def set_tecdoc_direct_cursor(db: Session, cursor: int) -> int:
    row = get_or_create_pipeline_state(db)
    row.tecdoc_direct_cursor = max(0, int(cursor))
    db.commit()
    return row.tecdoc_direct_cursor


def get_tecdoc_cross_cursor(db: Session) -> int:
    return int(get_or_create_pipeline_state(db).tecdoc_cross_cursor or 0)


def set_tecdoc_cross_cursor(db: Session, cursor: int) -> int:
    row = get_or_create_pipeline_state(db)
    row.tecdoc_cross_cursor = max(0, int(cursor))
    db.commit()
    return row.tecdoc_cross_cursor
