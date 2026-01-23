from fastapi import APIRouter
from app.routers.users import router as user_router
from app.routers.organizations import router as organizations_router
from app.routers.products import router as products_router
from app.routers.pending_products import router as pending_products_router
from app.routers.moderation_products import router as moderation_products_router
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
from app.routers.upload import router as upload_router
from app.routers.search_products import router as search_products_router
from app.routers.carts import router as carts_router
from app.routers.checkout import router as checkout_router
from app.routers.orders import router as orders_router
from app.routers.clients import router as clients_router


api_router = APIRouter(prefix="/api")


api_router.include_router(search_products_router)
api_router.include_router(rossko_router)
api_router.include_router(upload_router)
api_router.include_router(vehicles_router)

api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(organizations_router)
api_router.include_router(products_router)
api_router.include_router(pending_products_router)
api_router.include_router(moderation_products_router)
api_router.include_router(acquired_products_router)
api_router.include_router(storage_locations_router)
api_router.include_router(storage_cells_router)
api_router.include_router(pickup_locations_router)
api_router.include_router(stock_ins_router)
api_router.include_router(stock_outs_router)
api_router.include_router(carts_router)
api_router.include_router(checkout_router)
api_router.include_router(orders_router)
api_router.include_router(clients_router)
