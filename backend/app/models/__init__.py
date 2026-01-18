from app.models.user import User
from app.models.user_session import UserSession
from app.models.organization import Organization
from app.models.product import Product
from app.models.acquired_product import AcquiredProduct
from app.models.storage_location import StorageLocation
from app.models.storage_cell import StorageCell
from app.models.product_storage_cell import ProductStorageCell
from app.models.pickup_location import PickupLocation
from app.models.stock_in import StockIn
from app.models.stock_out import StockOut
from app.models.carts import Cart, NewPartsCart, UsedPartsCart
from app.models.orders import Order, NewPartsOrder, UsedPartsOrder, OrderStatus, OrderItem, OrderItemStatus
from app.models.client import Client

from sqlalchemy.orm import relationship

# User <-> Organization
User.organization = relationship(Organization, back_populates="users")

# Organization <-> Products
Organization.products = relationship(Product, back_populates="organization")

# Product <-> AcquiredProduct
Product.acquired_products = relationship(AcquiredProduct, back_populates="product")

# AcquiredProduct <-> StockIn/StockOut/Order
AcquiredProduct.stock_ins = relationship(StockIn, back_populates="acquired_product")
AcquiredProduct.stock_outs = relationship(StockOut, back_populates="acquired_product")


# Organization <-> StorageLocation/PickupLocation
Organization.storage_locations = relationship(StorageLocation, back_populates="organization")
Organization.pickup_locations = relationship(PickupLocation, back_populates="organization")

# StorageLocation <-> StockIn/StockOut
StorageLocation.stock_ins = relationship(StockIn, back_populates="storage_location")
StorageLocation.stock_outs = relationship(StockOut, back_populates="storage_location")



# AcquiredProduct <-> StockIn/StockOut
AcquiredProduct.stock_ins = relationship(StockIn, back_populates="acquired_product")
AcquiredProduct.stock_outs = relationship(StockOut, back_populates="acquired_product")

# User <-> Organization
User.organization = relationship(Organization, back_populates="users")

# User <-> StockOut/Order
User.stock_outs = relationship(StockOut, back_populates="user")


# StockIn/StockOut <-> Product/Organization
StockIn.product = relationship(Product, back_populates="stock_ins")
StockIn.organization = relationship(Organization, back_populates="stock_ins")
StockIn.storage_location = relationship(StorageLocation, back_populates="stock_ins")
StockIn.acquired_product = relationship(AcquiredProduct, back_populates="stock_ins")

StockOut.product = relationship(Product, back_populates="stock_outs")
StockOut.organization = relationship(Organization, back_populates="stock_outs")
StockOut.storage_location = relationship(StorageLocation, back_populates="stock_outs")
StockOut.acquired_product = relationship(AcquiredProduct, back_populates="stock_outs")
StockOut.user = relationship(User, back_populates="stock_outs")

# Cart relationships
User.carts = relationship(Cart, back_populates="user")

# Order relationships
User.orders = relationship(Order, back_populates="user")
OrderStatus.orders = relationship(Order, back_populates="status")
OrderItemStatus.order_items = relationship(OrderItem, back_populates="status")
Order.items = relationship(OrderItem, back_populates="order")
Order.new_parts_order = relationship(NewPartsOrder, back_populates="order")
Order.used_parts_order = relationship(UsedPartsOrder, back_populates="order")

