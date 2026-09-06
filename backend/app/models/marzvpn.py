"""MarzVPN bot tables (shared DB with Telegram VPN bot)."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.db.database import Base


class MarzVpnUser(Base):
    __tablename__ = "marzvpn_users"

    telegram_id = Column(BigInteger, primary_key=True)
    username = Column(String(255), nullable=True)
    marzban_username = Column(String(64), unique=True, nullable=False)
    subscription_url = Column(Text, nullable=False)
    crypt4_link = Column(Text, nullable=False)
    expire_at = Column(DateTime(timezone=True), nullable=False)
    referrer_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    key_valid = Column(Boolean, default=True, nullable=False)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    verify_note = Column(Text, nullable=True)
    # active | disabled | banned
    account_status = Column(String(32), nullable=False, default="active", server_default="active")


class MarzVpnReferral(Base):
    __tablename__ = "marzvpn_referrals"
    __table_args__ = (
        UniqueConstraint("referrer_id", "referred_id", name="uq_marzvpn_referral_pair"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    referrer_id = Column(
        BigInteger, ForeignKey("marzvpn_users.telegram_id"), nullable=False
    )
    referred_id = Column(
        BigInteger, ForeignKey("marzvpn_users.telegram_id"), nullable=False
    )
    reward_days = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MarzVpnPayment(Base):
    __tablename__ = "marzvpn_payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(
        BigInteger, ForeignKey("marzvpn_users.telegram_id"), nullable=False, index=True
    )
    amount_rub = Column(Numeric(12, 2), nullable=False, default=0)
    days_granted = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="pending")
    provider = Column(String(64), nullable=True)
    external_id = Column(String(128), nullable=True)
    note = Column(Text, nullable=True)
    created_by_admin_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
