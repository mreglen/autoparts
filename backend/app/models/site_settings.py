from sqlalchemy import Column, Integer, Boolean, Float

from ..db.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True)
    show_new_autoparts = Column(Boolean, nullable=False, default=True)
    new_parts_markup_percent = Column(Float, nullable=False, default=15.0)
