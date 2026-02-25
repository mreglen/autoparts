from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from ..db.database import Base

# Association table for many-to-many relationship between organizations and delivery methods
organization_delivery_methods = Table(
    "organization_delivery_methods",
    Base.metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("delivery_method_id", Integer, ForeignKey("delivery_methods.id")),
    Column("organization_id", String(10), ForeignKey("organizations.id"))
)


class DeliveryMethod(Base):
    __tablename__ = "delivery_methods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Many-to-many relationship with organizations through association table
    organizations = relationship(
        "Organization",
        secondary=organization_delivery_methods,
        back_populates="delivery_methods"
    )