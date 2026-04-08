from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from ..db.database import Base


class AvitoAutoloadJob(Base):
    __tablename__ = "avito_autoload_jobs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    job_type = Column(String(32), nullable=False, index=True)  # export | publish
    status = Column(String(32), nullable=False, default="pending", index=True)  # pending | processing | completed | failed
    stage = Column(String(64), nullable=False, default="queued")
    processed_count = Column(Integer, nullable=False, default=0)
    total_count = Column(Integer, nullable=False, default=0)
    celery_task_id = Column(String(128), nullable=True, index=True)
    result_file_ref = Column(String(512), nullable=True)
    payload_json = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
