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
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.models.avito_autoload_job import AvitoAutoloadJob
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_drom_integration import OrganizationDromIntegration
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.models.product_drom_listing_link import ProductDromListingLink
from app.models.site_yandex_integration import SiteYandexIntegration
from app.models.yandex_feed_sync_state import YandexFeedSyncState
from app.models.yandex_oauth_state import YandexOAuthState
from app.models.chat import Chat, Message, ChatParticipant
from app.models.part_type import PartType


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

# Product <-> Vehicle relationship using the association table
Product.compatible_vehicles = relationship("Vehicle", secondary="product_vehicle_association", back_populates="compatible_products")
Vehicle.compatible_products = relationship("Product", secondary="product_vehicle_association", back_populates="compatible_vehicles")

# Organization <-> DeliveryMethod relationship
Organization.delivery_methods = relationship("DeliveryMethod", secondary="organization_delivery_methods", back_populates="organizations")

# User <-> Chat relationships
User.buyer_chats = relationship("Chat", foreign_keys="Chat.buyer_id", back_populates="buyer")
User.seller_chats = relationship("Chat", foreign_keys="Chat.seller_id", back_populates="seller")
User.sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")

# Product <-> Chat relationship
Product.chats = relationship("Chat", back_populates="product")

