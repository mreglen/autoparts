from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Float, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), unique=True, nullable=False)  # Номер заказа
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # ID пользователя

    # Информация о получателе
    recipient_name = Column(String(100), nullable=False)
    recipient_phone = Column(String(20), nullable=False)
    recipient_email = Column(String(100), nullable=False)

    # Информация о доставке
    delivery_type = Column(String(20), nullable=False)  # 'pickup' или 'transport'
    delivery_address = Column(Text, nullable=True)  # Адрес доставки (для транспортных компаний)
    transport_company = Column(String(50), nullable=True)  # Название транспортной компании
    pickup_address = Column(Text, nullable=True)  # Адрес самовывоза

    # Информация об оплате
    total_amount = Column(Float, nullable=False)  # Общая сумма заказа
    is_paid = Column(Boolean, default=False)  # Статус оплаты

    # Статус заказа
    status_id = Column(Integer, ForeignKey("order_statuses.id"), nullable=False)
    
    # Источник заказа
    source = Column(String(20), nullable=False, server_default='garage')  # 'garage' или 'avito'
    avito_order_id = Column(BigInteger, nullable=True)  # ID заказа в Авито
    avito_status_code = Column(String(50), nullable=True)  # Статус из Авито
    avito_data = Column(JSON, nullable=True)  # Дополнительные данные из API Авито
    avito_last_name = Column(String(100), nullable=True)  # Фамилия клиента из Авито
    avito_first_name = Column(String(100), nullable=True)  # Имя клиента из Авито
    avito_patronymic = Column(String(100), nullable=True)  # Отчество клиента из Авито

    # Даты
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связи
    user = relationship("User", back_populates="orders")
    status = relationship("OrderStatus", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    new_parts_order = relationship("NewPartsOrder", back_populates="order", uselist=False)
    used_parts_order = relationship("UsedPartsOrder", back_populates="order", uselist=False)

    def __repr__(self):
        return f"<Order(id={self.id}, order_number='{self.order_number}', user_id={self.user_id}, total={self.total_amount})>"
