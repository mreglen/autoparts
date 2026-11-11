from sqlalchemy import Column, Integer, Boolean, Float, String, Text

from ..db.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True)
    show_new_autoparts = Column(Boolean, nullable=False, default=True)
    show_site_reviews = Column(Boolean, nullable=False, default=True)
    show_yandex_badge = Column(Boolean, nullable=False, default=True)
    new_parts_markup_percent = Column(Float, nullable=False, default=15.0)
    buyer_new_parts_markup_percent = Column(Float, nullable=False, default=30.0)
    autoservice_new_parts_markup_percent = Column(Float, nullable=False, default=7.0)
    used_parts_purchase_mode = Column(String(20), nullable=False, default="both")
    round_product_prices = Column(Boolean, nullable=False, default=False)
    show_warehouse_inventory = Column(Boolean, nullable=False, default=False)
    show_autoservice = Column(Boolean, nullable=False, default=False)
    smsc_login = Column(String(64), nullable=True)
    smsc_password = Column(String(200), nullable=True)
    smsgold_user = Column(String(64), nullable=True)
    smsgold_password = Column(String(200), nullable=True)
    smsgold_sender = Column(String(16), nullable=True)
    sms_provider = Column(String(16), nullable=False, default="smsgold")
    mobile_min_app_version = Column(String(32), nullable=True)
    mobile_apk_version = Column(String(32), nullable=True)
    mobile_apk_url = Column(String(500), nullable=True)
    mobile_apk_notes = Column(Text, nullable=True)
