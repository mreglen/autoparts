from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class AutoserviceWarehouseItem(Base):
    __tablename__ = "autoservice_warehouse_items"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "brand",
            "article",
            name="uq_autoservice_wh_item_org_brand_article",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    brand = Column(String(120), nullable=False, default="")
    article = Column(String(120), nullable=False, default="")
    name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    reserved_qty = Column(Integer, nullable=False, default=0)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization")
    receipts = relationship(
        "AutoserviceWarehouseReceipt",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    expenses = relationship(
        "AutoserviceWarehouseExpense",
        back_populates="item",
        cascade="all, delete-orphan",
    )

    @property
    def available_qty(self) -> int:
        return max(0, int(self.quantity or 0) - int(self.reserved_qty or 0))


class AutoserviceWarehouseReceipt(Base):
    __tablename__ = "autoservice_warehouse_receipts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    item_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0)
    cart_item_type = Column(String(16), nullable=True, index=True)
    cart_item_id = Column(Integer, nullable=True, index=True)
    repair_order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(Date, server_default=func.current_date(), nullable=False)

    organization = relationship("Organization")
    item = relationship("AutoserviceWarehouseItem", back_populates="receipts")
    repair_order = relationship("RepairOrder")
    creator = relationship("User", foreign_keys=[created_by])


class AutoserviceWarehouseExpense(Base):
    __tablename__ = "autoservice_warehouse_expenses"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    item_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0)
    reason = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(Date, server_default=func.current_date(), nullable=False)

    organization = relationship("Organization")
    item = relationship("AutoserviceWarehouseItem", back_populates="expenses")
    creator = relationship("User", foreign_keys=[created_by])
