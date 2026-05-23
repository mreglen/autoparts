from fastapi import APIRouter
from app.routers.users import router as user_router
from app.routers.organizations import router as organizations_router
from app.routers.products import router as products_router
from app.routers.pending_products import router as pending_products_router
from app.routers.moderation_products import router as moderation_products_router
from app.routers.pending_product_storage_cells import router as pending_product_storage_cells_router

from app.routers.acquired_products import router as acquired_products_router
from app.routers.storage_locations import router as storage_locations_router
from app.routers.storage_cells import router as storage_cells_router
from app.routers.pickup_locations import router as pickup_locations_router
from app.routers.stock_ins import router as stock_ins_router
from app.routers.stock_outs import router as stock_outs_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.routers.rossko_api.rossko_api import router as rossko_router
from app.routers.vehicles import router as vehicles_router
from app.routers.vehicle_catalog import router as vehicle_catalog_router
from app.routers.transmissions import router as transmissions_router
from app.routers.upload import router as upload_router
from app.routers.search_products import router as search_products_router
from app.routers.catalog import router as catalog_router
from app.routers.tecdoc_parts import router as tecdoc_parts_router
from app.routers.carts import router as carts_router
from app.routers.checkout import router as checkout_router
from app.routers.clients import router as clients_router
from app.routers.employees import router as employees_router
from app.routers.delivery_methods import router as delivery_methods_router
from app.routers.printers import router as printers_router
from app.routers.avito_integration import router as avito_integration_router
from app.routers.avito_messenger import router as avito_messenger_router
from app.routers.drom_integration import router as drom_integration_router
from app.routers.sales import router as sales_router
from app.routers.finance import router as finance_router
from app.routers.audit import router as audit_router
from app.routers.orders_meta import router as orders_meta_router
from app.routers.orders_legacy import router as orders_legacy_router
from app.routers.yandex_feeds import router as yandex_feeds_router
from app.routers.public_feeds import router as public_feeds_router
from app.routers.site_delivery import router as site_delivery_router



api_router = APIRouter(prefix="/api")



api_router.include_router(search_products_router)
api_router.include_router(catalog_router)
api_router.include_router(rossko_router)
api_router.include_router(upload_router)
api_router.include_router(vehicles_router)
api_router.include_router(vehicle_catalog_router)
api_router.include_router(transmissions_router)
api_router.include_router(tecdoc_parts_router)

api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(organizations_router)
api_router.include_router(products_router)
api_router.include_router(pending_products_router)
api_router.include_router(moderation_products_router)
api_router.include_router(pending_product_storage_cells_router)

api_router.include_router(acquired_products_router)
api_router.include_router(storage_locations_router)
api_router.include_router(storage_cells_router)
api_router.include_router(pickup_locations_router)
api_router.include_router(stock_ins_router)
api_router.include_router(stock_outs_router)
api_router.include_router(carts_router)
api_router.include_router(checkout_router)
api_router.include_router(clients_router)
api_router.include_router(employees_router)
api_router.include_router(delivery_methods_router)
api_router.include_router(printers_router)
api_router.include_router(avito_integration_router)
api_router.include_router(avito_messenger_router)
api_router.include_router(drom_integration_router)
api_router.include_router(sales_router)
api_router.include_router(finance_router)
api_router.include_router(audit_router)
api_router.include_router(orders_meta_router)
api_router.include_router(orders_legacy_router)
api_router.include_router(yandex_feeds_router)
api_router.include_router(public_feeds_router)
api_router.include_router(site_delivery_router)

