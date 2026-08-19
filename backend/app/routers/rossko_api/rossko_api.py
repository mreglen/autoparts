from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.core.auth import get_current_admin_user
from app.models.user import User
from app.schemas.rossko import CheckoutRequest, GetOrdersRequest, SearchRequest
from app.db.database import get_db
from app.utils.rossko_api_keys import RosskoApiKeysError, get_rossko_api_keys
from datetime import datetime
from zeep import Client
from zeep.helpers import serialize_object
from zeep.transports import Transport
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rossko", tags=["ROSSKO API"])
settings = Settings()

# Lazy initialization - create clients only when needed
_client_search = None
_client_details = None
_client_checkout = None
_client_orders = None

def get_search_client():
    global _client_search
    if _client_search is None:
        try:
            transport = Transport()
            # Remove ?wsdl from URL if present, zeep adds it automatically
            wsdl_url = settings.GET_SEARCH.replace('?wsdl', '').rstrip('?')
            logger.info(f"Creating search client with URL: {wsdl_url}?wsdl")
            _client_search = Client(wsdl_url + '?wsdl', transport=transport)
        except Exception as e:
            logger.error(f"Failed to create search client: {e}")
            raise
    return _client_search

def get_details_client():
    global _client_details
    if _client_details is None:
        try:
            transport = Transport()
            wsdl_url = settings.GET_CHECK_OUT_DETAILS.replace('?wsdl', '').rstrip('?')
            _client_details = Client(wsdl_url + '?wsdl', transport=transport)
        except Exception as e:
            logger.error(f"Failed to create details client: {e}")
            raise
    return _client_details

def get_checkout_client():
    global _client_checkout
    if _client_checkout is None:
        try:
            transport = Transport()
            wsdl_url = settings.GET_CHECK_OUT.replace('?wsdl', '').rstrip('?')
            _client_checkout = Client(wsdl_url + '?wsdl', transport=transport)
        except Exception as e:
            logger.error(f"Failed to create checkout client: {e}")
            raise
    return _client_checkout

def get_orders_client():
    global _client_orders
    if _client_orders is None:
        try:
            transport = Transport()
            wsdl_url = settings.GET_ORDERS.replace('?wsdl', '').rstrip('?')
            _client_orders = Client(wsdl_url + '?wsdl', transport=transport)
        except Exception as e:
            logger.error(f"Failed to create orders client: {e}")
            raise
    return _client_orders


rossko_delivery_id = "000000001"
rossko_address_id = 176458


async def save_stock_data_to_db(search_result: dict, db: Session):
    """
    Функция сохранения данных складов отключена
    """
    # Заглушка - сохранение данных складов отключено
    pass

async def rossko_checkout(checkout_data, db: Session | None = None):
    """Отправка заказа в RossKo API"""
    try:
        key1, key2 = get_rossko_api_keys(db)
        params = {
            "KEY1": key1,
            "KEY2": key2,
            "delivery": checkout_data["delivery"],
            "payment": checkout_data["payment"],
            "contact": checkout_data["contact"],
            "delivery_parts": checkout_data["delivery_parts"],
            "PARTS": {
                "Part": checkout_data["parts"]
            }
        }

        def clean(data):
            if isinstance(data, dict):
                return {k: clean(v) for k, v in data.items() if v is not None}
            if isinstance(data, list):
                return [clean(i) for i in data]
            return data

        params = clean(params)

        result = get_checkout_client().service.GetCheckout(**params)
        serialized_result = serialize_object(result)
        return serialized_result

    except RosskoApiKeysError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса GetCheckout: {str(error)}")

def _blocking_get_search(params: dict) -> object:
    return get_search_client().service.GetSearch(**params)


async def rossko_search(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        key1, key2 = get_rossko_api_keys(db)
        params = {
            "KEY1": key1,
            "KEY2": key2,
            "text": request.text,
            "delivery_id": request.delivery_id,
        }
        if request.address_id is not None:
            params["address_id"] = request.address_id

        result = await asyncio.to_thread(_blocking_get_search, params)
        serialized_result = serialize_object(result)

        # Сохраняем данные о складах в базу данных
        await save_stock_data_to_db(serialized_result, db)

        return serialized_result

    except RosskoApiKeysError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("ROSSKO GetSearch failed for text=%r", request.text)
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса: {str(error)}")


@router.post("/GetSearch")
async def search_items(request: SearchRequest, db: Session = Depends(get_db)):
    return await rossko_search(request, db)
    

@router.get("/GetCheckoutDetails")
async def get_details(
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        key1, key2 = get_rossko_api_keys(db)
        params = {
            "KEY1": key1,
            "KEY2": key2,
        }

        result = get_details_client().service.GetCheckoutDetails(**params)
        return result

    except RosskoApiKeysError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса: {str(error)}")


@router.post("/GetCheckout")
async def get_checkout(
    request: CheckoutRequest,
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        key1, key2 = get_rossko_api_keys(db)
        params = {
            "KEY1": key1,
            "KEY2": key2,

            "delivery": {
                "delivery_id": request.delivery.delivery_id,
                "address_id": request.delivery.address_id
            },

            "payment": {
                "payment_id": request.payment.payment_id,
                "requisite_id": request.payment.requisite_id
            },

            "contact": {
                "name": request.contact.name,
                "phone": request.contact.phone,
                "comment": request.contact.comment
            },

            "delivery_parts": request.delivery_parts,

            "PARTS": {
                "Part": [
                    {
                        "partnumber": part.partnumber,
                        "brand": part.brand,
                        "stock": part.stock,
                        "count": part.count,
                        "comment": part.comment
                    }
                    for part in request.parts
                ]
            }
        }

  
        def clean(data):
            if isinstance(data, dict):
                return {k: clean(v) for k, v in data.items() if v is not None}
            if isinstance(data, list):
                return [clean(i) for i in data]
            return data

        params = clean(params)

        result = get_checkout_client().service.GetCheckout(**params)

        return serialize_object(result)

    except RosskoApiKeysError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rossko GetCheckout error: {str(e)}"
        )

@router.post("/GetOrders")
async def get_orders(
    request: GetOrdersRequest,
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        key1, key2 = get_rossko_api_keys(db)
        params = {
            "KEY1": key1,
            "KEY2": key2,
        }

        if request.order_ids:
            params["order_ids"] = {
                "id": request.order_ids.id
            }

        if request.limit is not None:
            params["limit"] = request.limit

        if request.type is not None:
            params["type"] = request.type

        if request.start_date is not None:
            params["start_date"] = request.start_date.strftime("%Y-%m-%d")

        if request.end_date is not None:
            params["end_date"] = request.end_date.strftime("%Y-%m-%d")

    
        def clean(data):
            if isinstance(data, dict):
                return {k: clean(v) for k, v in data.items() if v is not None}
            if isinstance(data, list):
                return [clean(i) for i in data]
            return data

        params = clean(params)

        result = get_orders_client().service.GetOrders(**params)

        return serialize_object(result)

    except RosskoApiKeysError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rossko GetOrders error: {str(e)}"
        )