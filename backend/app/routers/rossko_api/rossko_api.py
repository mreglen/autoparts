from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.schemas.rossko import CheckoutRequest, GetOrdersRequest, SearchRequest
from app.db.database import get_db
from datetime import datetime
from zeep import Client
from zeep.helpers import serialize_object

router = APIRouter(prefix="/rossko", tags=["ROSSKO API"])
settings = Settings()

client_search = Client(settings.GET_SEARCH)
client_details = Client(settings.GET_CHECK_OUT_DETAILS)
client_checkout = Client(settings.GET_CHECK_OUT)
client_orders = Client(settings.GET_ORDERS)


rossko_delivery_id = "000000001"
rossko_address_id = 176458


async def save_stock_data_to_db(search_result: dict, db: Session):
    """
    Функция сохранения данных складов отключена
    """
    # Заглушка - сохранение данных складов отключено
    pass

async def rossko_checkout(checkout_data):
    """Отправка заказа в RossKo API"""
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,
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

        result = client_checkout.service.GetCheckout(**params)
        serialized_result = serialize_object(result)
        return serialized_result

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса GetCheckout: {str(error)}")

async def rossko_search(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,
            "text": request.text,
            "delivery_id": request.delivery_id,
        }
        if request.address_id is not None:
            params["address_id"] = request.address_id

        result = client_search.service.GetSearch(**params)

        serialized_result = serialize_object(result)

        # Debug: log the response structure
        print(f"ROSSKO API response structure: {serialized_result}")
        print(f"PartsList exists: {'PartsList' in serialized_result}")
        if 'PartsList' in serialized_result:
            print(f"PartsList content: {serialized_result['PartsList']}")

        # Сохраняем данные о складах в базу данных
        await save_stock_data_to_db(serialized_result, db)

        return serialized_result

    except Exception as error:
        print(f"ROSSKO API Error: {str(error)}")
        print(f"Error type: {type(error)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса: {str(error)}")


@router.post("/GetSearch")
async def search_items(request: SearchRequest, db: Session = Depends(get_db)):
    return await rossko_search(request, db)
    

@router.get("/GetCheckoutDetails")
async def get_details():
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,
        }

        result = client_details.service.GetCheckoutDetails(**params)
        return result

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Ошибка при выполнении запроса: {str(error)}")


@router.post("/GetCheckout")
async def get_checkout(request: CheckoutRequest):
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,

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

        result = client_checkout.service.GetCheckout(**params)

        return serialize_object(result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rossko GetCheckout error: {str(e)}"
        )

@router.post("/GetOrders")
async def get_orders(request: GetOrdersRequest):
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,
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

        result = client_orders.service.GetOrders(**params)

        return serialize_object(result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rossko GetOrders error: {str(e)}"
        )