from sqlalchemy import Column, Integer

from app.db.database import Base


class SeoPipelineState(Base):
    __tablename__ = "seo_pipeline_state"

    id = Column(Integer, primary_key=True, default=1)
    tecdoc_direct_cursor = Column(Integer, nullable=False, default=0)
    tecdoc_cross_cursor = Column(Integer, nullable=False, default=0)
