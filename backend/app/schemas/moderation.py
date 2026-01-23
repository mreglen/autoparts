from pydantic import BaseModel
from typing import Optional


class ModerateProductRequest(BaseModel):
    rejection_reason: Optional[str] = None


class ModerateProductResponse(BaseModel):
    message: str
    product_id: int