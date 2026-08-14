from decimal import Decimal

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

repair_order_assignees = Table(
    "repair_order_assignees",
    Base.metadata,
    Column(
        "order_id",
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "user_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint("order_id", "user_id", name="uq_repair_order_assignees_order_user"),
)


class RepairOrder(Base):
    __tablename__ = "repair_orders"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "order_number",
            name="uq_repair_orders_org_order_number",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    order_number = Column(String(32), nullable=False, index=True)
    client_id = Column(
        Integer,
        ForeignKey("autoservice_clients.id"),
        nullable=False,
        index=True,
    )
    vehicle_id = Column(
        Integer,
        ForeignKey("garage_vehicles.id"),
        nullable=False,
        index=True,
    )
    client_comment = Column(Text, nullable=True)
    staff_comment = Column(Text, nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    accepted_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    status = Column(String(32), nullable=False, default="accepted")
    work_zone_id = Column(
        Integer,
        ForeignKey("autoservice_work_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    scheduled_end_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
    client = relationship("AutoserviceClient", foreign_keys=[client_id])
    vehicle = relationship("GarageVehicle", foreign_keys=[vehicle_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_user_id])
    work_zone = relationship("AutoserviceWorkZone", foreign_keys=[work_zone_id])
    assignees = relationship(
        "User",
        secondary=repair_order_assignees,
        lazy="joined",
    )
    works = relationship(
        "RepairOrderWork",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="RepairOrderWork.position",
        lazy="selectin",
    )
    client_parts = relationship(
        "RepairOrderClientPart",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="RepairOrderClientPart.position",
        lazy="selectin",
    )
    shop_parts = relationship(
        "RepairOrderShopPart",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="RepairOrderShopPart.position",
        lazy="selectin",
    )
    payments = relationship(
        "AutoservicePayment",
        foreign_keys="AutoservicePayment.repair_order_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class RepairOrderWork(Base):
    __tablename__ = "repair_order_works"

    id = Column(Integer, primary_key=True)
    order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=1)
    catalog_work_id = Column(
        Integer,
        ForeignKey("autoservice_works.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(255), nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    executor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    order = relationship("RepairOrder", back_populates="works")
    catalog_work = relationship("AutoserviceWork", foreign_keys=[catalog_work_id])
    executor = relationship("User", foreign_keys=[executor_user_id])
    executors = relationship(
        "RepairOrderWorkExecutor",
        back_populates="work",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class RepairOrderWorkExecutor(Base):
    __tablename__ = "repair_order_work_executors"

    id = Column(Integer, primary_key=True)
    work_id = Column(
        Integer,
        ForeignKey("repair_order_works.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id = Column(
        Integer,
        ForeignKey("autoservice_service_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    percent = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))

    work = relationship("RepairOrderWork", back_populates="executors")
    employee = relationship("AutoserviceServiceEmployee", foreign_keys=[employee_id])


class RepairOrderClientPart(Base):
    __tablename__ = "repair_order_client_parts"

    id = Column(Integer, primary_key=True)
    order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    unit = Column(String(16), nullable=False, default="pcs")

    order = relationship("RepairOrder", back_populates="client_parts")


class RepairOrderShopPart(Base):
    __tablename__ = "repair_order_shop_parts"

    id = Column(Integer, primary_key=True)
    order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    qty = Column(Numeric(12, 3), nullable=False, default=Decimal("1.000"))
    unit = Column(String(16), nullable=False, default="pcs")
    unit_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    markup_percent = Column(Numeric(6, 2), nullable=False, default=Decimal("5.00"))
    client_unit_price_override = Column(Numeric(12, 2), nullable=True)
    source = Column(String(32), nullable=False, default="manual")
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    autoservice_stock_item_id = Column(
        Integer,
        ForeignKey("autoservice_warehouse_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    brand = Column(String(120), nullable=True)
    partnumber = Column(String(120), nullable=True)
    rossko_brand = Column(String(120), nullable=True)
    rossko_partnumber = Column(String(120), nullable=True)
    cart_item_type = Column(String(16), nullable=True)
    cart_item_id = Column(Integer, nullable=True)

    order = relationship("RepairOrder", back_populates="shop_parts")
    product = relationship("Product", foreign_keys=[product_id])
    autoservice_stock_item = relationship(
        "AutoserviceWarehouseItem",
        foreign_keys=[autoservice_stock_item_id],
    )
