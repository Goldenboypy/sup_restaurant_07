"""
guest_api/schemas.py
----------------------
Pydantic (Django Ninja) schemas — defines the shape of every
request body and response payload.

Connection map:
    ← models.py  : properties like active_price / discount_percent / subtotal
                   are read directly from model instances via from_orm()
    → routers.py : every router function uses these schemas as
                   type hints for input (body) and response
    → auth.py    : RegisterSchema, LoginSchema, TokenSchema, UserOut
"""

from decimal import Decimal
from datetime import datetime, time
from typing import List, Optional

from ninja import Schema


# ===========================================================================
# AUTH
# ===========================================================================
class RegisterSchema(Schema):
    username:   str = ""        # min 3 chars validated in auth.py
    email:      str = ""
    password:   str = ""        # min 6 chars validated in auth.py
    first_name: str = ""
    last_name:  str = ""


class LoginSchema(Schema):
    username: str = ""
    password: str = ""


class TokenSchema(Schema):
    """Returned after successful register or login."""
    access:     str = ""
    token_type: str = "Bearer"


class UserOut(Schema):
    id:         int
    username:   str
    email:      str
    first_name: str
    last_name:  str


class TableSessionOut(Schema):
    session_token: str
    table_id:      int
    table_number:  str
    table_label:   str
    status:        str
    started_at:    datetime
    ended_at:      Optional[datetime] = None


class MenuCategoryOut(Schema):
    id:         int
    name:       str
    image_url:  Optional[str] = None


class MenuItemSummaryOut(Schema):
    id:          int
    name:        str
    price:       Decimal
    image_url:   Optional[str] = None
    category_id: int


class IngredientOut(Schema):
    id:       int
    name:     str
    allergen: bool = False


class MenuItemDetailOut(MenuItemSummaryOut):
    description: Optional[str] = None
    ingredients: list[IngredientOut]


class GuestCartItemIn(Schema):
    item_id: int
    excluded_ingredients: list[str] = []


class GuestCartItemOut(Schema):
    cart_item_id: str
    item_id: int
    name: str
    quantity: int
    excluded_ingredients: list[str]
    photo_url: str = ""


class GuestOrderOut(Schema):
    id: int
    status: str
    placed_at: datetime
    items: list[GuestCartItemOut]


class GuestBillItemOut(GuestCartItemOut):
    price: Decimal
    subtotal: Decimal
    photo_url: str = ""


class GuestBillOrderOut(Schema):
    id: int
    status: str
    placed_at: datetime
    items: list[GuestBillItemOut]


class GuestBillOut(Schema):
    total: Decimal
    currency: str
    orders: list[GuestBillOrderOut]


class GuestPaymentIn(Schema):
    method: str


# ===========================================================================
# CATEGORY
# ===========================================================================
class CategoryOut(Schema):
    id:          int
    name:        str
    slug:        str
    description: str
    icon:        str
    created_at:  datetime


class CategoryIn(Schema):
    name:        str = ""
    slug:        str = ""
    description: str = ""
    icon:        str = ""


# ===========================================================================
# BRANCH
# ===========================================================================
class BranchOut(Schema):
    id:           int
    name:         str
    city:         str
    address:      str
    phone:        str
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None
    is_open_24h:  bool
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    is_active:    bool


class BranchIn(Schema):
    name:         str = ""
    city:         str = ""
    address:      str = ""
    phone:        str = ""
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None
    is_open_24h:  bool = False
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None


# ===========================================================================
# PRODUCT
# ===========================================================================
class ProductOut(Schema):
    id:               int
    name:             str
    slug:             str
    description:      str
    price:            Decimal
    discount_price:   Optional[Decimal] = None
    active_price:     Decimal           # ← from Product.active_price property
    discount_percent: int               # ← from Product.discount_percent property
    unit:             str
    brand:            str
    image_url:        str
    is_available:     bool
    is_halal:         bool
    is_featured:      bool
    stock_quantity:   int
    category_id:      int
    created_at:       datetime

    class Config:
        from_attributes = True          # allows from_orm()


class ProductIn(Schema):
    category_id:    int
    name:           str     = ""
    slug:           str     = ""
    description:    str     = ""
    price:          Decimal = Decimal("0")
    discount_price: Optional[Decimal] = None
    unit:           str     = "dona"
    barcode:        str     = ""
    brand:          str     = ""
    image_url:      str     = ""
    is_halal:       bool    = False
    is_featured:    bool    = False
    stock_quantity: int     = 0


class ProductUpdate(Schema):
    """PATCH body — all fields optional."""
    price:          Optional[Decimal] = None
    discount_price: Optional[Decimal] = None
    stock_quantity: Optional[int]     = None
    is_available:   Optional[bool]    = None
    is_featured:    Optional[bool]    = None


class PaginatedProducts(Schema):
    count:     int
    page:      int
    page_size: int
    results:   List[ProductOut]


# ===========================================================================
# CART
# ===========================================================================
class CartItemOut(Schema):
    id:            int
    product_id:    int
    product_name:  str
    product_image: str
    quantity:      int
    unit_price:    Decimal
    subtotal:      Decimal  # ← from CartItem.subtotal property


class CartOut(Schema):
    item_count: int         # ← from Cart.item_count property
    total:      Decimal     # ← from Cart.total property
    items:      List[CartItemOut]


class CartAddSchema(Schema):
    product_id: int
    quantity:   int = 1     # 1–100 validated in routers.py


class CartUpdateSchema(Schema):
    quantity: int = 0       # 0 means remove the item


# ===========================================================================
# ORDER
# ===========================================================================
class OrderItemOut(Schema):
    product_id:   int
    product_name: str
    quantity:     int
    price:        Decimal
    subtotal:     Decimal   # ← from OrderItem.subtotal property


class OrderOut(Schema):
    id:               int
    status:           str
    delivery_type:    str
    delivery_address: str
    total_price:      Decimal
    delivery_fee:     Decimal
    note:             str
    created_at:       datetime
    items:            List[OrderItemOut]


class OrderCreateSchema(Schema):
    delivery_type:    str           = "delivery"  # "delivery" | "pickup"
    delivery_address: str           = ""
    branch_id:        Optional[int] = None        # required when delivery_type="pickup"
    note:             str           = ""


# ===========================================================================
# LOYALTY CARD
# ===========================================================================
class LoyaltyCardOut(Schema):
    card_number:      str
    bonus_points:     int
    total_spent:      Decimal
    cashback_percent: int       # ← from LoyaltyCard.cashback_percent property


# ===========================================================================
# GENERIC
# ===========================================================================
class MessageOut(Schema):
    message: str