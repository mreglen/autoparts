from pydantic import BaseModel
from typing import Optional


class PublicUserProfileBase(BaseModel):
    public_code: str
    display_name: str
    avatar_url: Optional[str] = None
    is_seller: bool = False
    is_buyer: bool = False


class PublicSellerProfile(PublicUserProfileBase):
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    organization_logo: Optional[str] = None
    catalog_products_count: int = 0


class PublicBuyerProfile(PublicUserProfileBase):
    pass


class PublicUserProfile(PublicUserProfileBase):
    """Единый публичный профиль по /users/{public_code}."""
    user_id: int
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    organization_logo: Optional[str] = None
    catalog_products_count: int = 0


class ChatParticipantPublic(BaseModel):
    user_id: int
    public_code: str
    display_name: str
    avatar_url: Optional[str] = None
    is_seller: bool = False
    is_buyer: bool = False


class ChatParticipantsResponse(BaseModel):
    chat_id: int
    is_group: bool
    participants: list[ChatParticipantPublic]
