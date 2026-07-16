from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from ..db.database import Base

organization_payment_methods = Table(
    "organization_payment_methods",
    Base.metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("payment_method_id", Integer, ForeignKey("payment_methods.id")),
    Column("organization_id", String(10), ForeignKey("organizations.id")),
)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    organizations = relationship(
        "Organization",
        secondary=organization_payment_methods,
        back_populates="payment_methods",
    )
