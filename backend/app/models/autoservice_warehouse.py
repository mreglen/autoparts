from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class AutoserviceWarehouseReceiptDoc(Base):
    __tablename__ = "autoservice_warehouse_receipt_docs"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "number",
            name="uq_autoservice_wh_receipt_doc_org_number",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    number = Column(String(32), nullable=False)
    doc_date = Column(Date, server_default=func.current_date(), nullable=False)
    supplier_kind = Column(String(24), nullable=False)
    supplier_name = Column(String(255), nullable=False)
    source_order_type = Column(String(8), nullable=True)
    source_order_id = Column(Integer, nullable=True)
    repair_order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization")
    repair_order = relationship("RepairOrder")
    creator = relationship("User", foreign_keys=[created_by])
    lines = relationship(
        "AutoserviceWarehouseReceipt",
        back_populates="document",
        cascade="all, delete-orphan",
    )


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
    return_reserved_qty = Column(Integer, nullable=False, default=0)
    unit = Column(String(16), nullable=False, default="pcs")
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
        return max(
            0,
            int(self.quantity or 0)
            - int(self.reserved_qty or 0)
            - int(self.return_reserved_qty or 0),
        )


class AutoserviceWarehouseReceipt(Base):
    __tablename__ = "autoservice_warehouse_receipts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    document_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_receipt_docs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    item_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity = Column(Integer, nullable=False)
    return_reserved_qty = Column(Integer, nullable=False, default=0)
    returned_qty = Column(Integer, nullable=False, default=0)
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
    document = relationship("AutoserviceWarehouseReceiptDoc", back_populates="lines")
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
    return_request_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_return_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(Date, server_default=func.current_date(), nullable=False)

    organization = relationship("Organization")
    item = relationship("AutoserviceWarehouseItem", back_populates="expenses")
    creator = relationship("User", foreign_keys=[created_by])


class AutoserviceWarehouseReturnRequest(Base):
    __tablename__ = "autoservice_warehouse_return_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    supplier_organization_id = Column(
        String,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
    )
    receipt_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_receipts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_order_type = Column(String(8), nullable=False)
    source_order_id = Column(Integer, nullable=False, index=True)
    cart_item_type = Column(String(16), nullable=False)
    cart_item_id = Column(Integer, nullable=False, index=True)
    provider_kind = Column(String(24), nullable=False, index=True)
    processing_mode = Column(String(16), nullable=False, default="manual")
    supplier_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0)
    reason = Column(String(50), nullable=False)
    comment = Column(Text, nullable=True)
    photo_urls_json = Column(Text, nullable=True)
    status_code = Column(String(32), nullable=False, default="requested", index=True)
    seller_note = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    status_changed_at = Column(DateTime, server_default=func.now(), nullable=False)

    receipt = relationship("AutoserviceWarehouseReceipt")
    item = relationship("AutoserviceWarehouseItem")
    creator = relationship("User", foreign_keys=[created_by])
