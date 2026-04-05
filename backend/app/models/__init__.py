from app.models.user import User
from app.models.user_session import UserSession
from app.models.organization import Organization
from app.models.product import Product
from app.models.pending_product import PendingProduct
from app.models.rejected_product import RejectedProduct
from app.models.acquired_product import AcquiredProduct
from app.models.storage_location import StorageLocation
from app.models.storage_cell import StorageCell
from app.models.product_storage_cell import ProductStorageCell
from app.models.pickup_location import PickupLocation
from app.models.stock_in import StockIn
from app.models.stock_out import StockOut
from app.models.carts import Cart, NewPartsCart, UsedPartsCart, GuestCart, GuestNewPartsCart, GuestUsedPartsCart
from app.models.orders import Order, NewPartsOrder, UsedPartsOrder, OrderStatus, OrderItem, OrderItemStatus
from app.models.client import Client
from app.models.permission import Permission
from app.models.user_permission import UserPermission
from app.models.vehicle import Vehicle
from app.models.vehicle_photo import VehiclePhoto
from app.models.vehicle_vin import VehicleVin
from app.models.vehicle_mileage import VehicleMileage
from app.models.transmission import Transmission, VehicleTransmission
from app.models.tecdoc import (
    TecdocManufacturer,
    TecdocModel,
    TecdocEngine,
    TecdocPassengercar,
    TecdocPassengercarLinkEngine,
)
from app.models.product_vehicle import ProductVehicleAssociation
from app.models.delivery_method import DeliveryMethod, organization_delivery_methods


from sqlalchemy.orm import relationship

# User <-> Organization
User.organization = relationship(Organization, back_populates="users")

# Organization <-> Products
Organization.products = relationship(Product, back_populates="organization")

# Product <-> AcquiredProduct
Product.acquired_products = relationship(AcquiredProduct, back_populates="product")

# AcquiredProduct <-> StockIn/StockOut/Order
AcquiredProduct.stock_ins = relationship(StockIn, back_populates="acquired_product")

# StorageLocation <-> StockIn/StockOut
StorageLocation.stock_ins = relationship(StockIn, back_populates="storage_location")
StorageLocation.stock_outs = relationship(StockOut, back_populates="storage_location")


# AcquiredProduct <-> StockIn/StockOut
AcquiredProduct.stock_ins = relationship(StockIn, back_populates="acquired_product")
AcquiredProduct.stock_outs = relationship(StockOut, back_populates="acquired_product")


# Organization <-> StorageLocation/PickupLocation
Organization.storage_locations = relationship(StorageLocation, back_populates="organization")
Organization.pickup_locations = relationship(PickupLocation, back_populates="organization")

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

# Product <-> Vehicle relationship using the association table
Product.compatible_vehicles = relationship("Vehicle", secondary="product_vehicle_association", back_populates="compatible_products")
Vehicle.compatible_products = relationship("Product", secondary="product_vehicle_association", back_populates="compatible_vehicles")

# Organization <-> DeliveryMethod relationship
Organization.delivery_methods = relationship("DeliveryMethod", secondary="organization_delivery_methods", back_populates="organizations")

