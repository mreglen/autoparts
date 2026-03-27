from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base


class PrinterAgentPrinter(Base):
    """
    Конкретный принтер, который перечислил агент на конкретном ПК.
    """

    __tablename__ = "printer_agent_printers"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("printer_agents.id", ondelete="CASCADE"), nullable=False, index=True)

    printer_name = Column(String(255), nullable=False)
    driver_name = Column(String(255), nullable=True)
    port_name = Column(String(255), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("PrinterAgent")

