from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserFavorite(Base):
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_user_favorites_user_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])


class UserProductView(Base):
    __tablename__ = "user_product_views"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_user_product_views_user_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    viewed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])


class SearchSubscription(Base):
    __tablename__ = "search_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "query_normalized", name="uq_search_subscriptions_user_query"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    query_text = Column(Text, nullable=False)
    query_normalized = Column(String(512), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    unsubscribe_token = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_notified_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    notifications = relationship(
        "SearchSubscriptionNotification",
        back_populates="subscription",
        cascade="all, delete-orphan",
    )


class SearchSubscriptionNotification(Base):
    __tablename__ = "search_subscription_notifications"
    __table_args__ = (
        UniqueConstraint(
            "subscription_id",
            "product_id",
            name="uq_search_subscription_notifications_sub_product",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(
        Integer,
        ForeignKey("search_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    notified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    subscription = relationship("SearchSubscription", back_populates="notifications")
    product = relationship("Product", foreign_keys=[product_id])
