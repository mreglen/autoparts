from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base


class PrinterPermission(Base):
    """
    Кто имеет право печатать на конкретном принтере.
    На данном этапе UI “выбирает принтер” для пользователя, поэтому в коде
    можно делать упор на сценарий “один текущий принтер на пользователя”.
    """

    __tablename__ = "printer_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    printer_id = Column(Integer, ForeignKey("printer_agent_printers.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "printer_id", name="uq_printer_permissions_user_printer"),
    )

    user = relationship("User")
    printer = relationship("PrinterAgentPrinter")

