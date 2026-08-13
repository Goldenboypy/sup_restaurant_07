"""
guest_api/routers.py
----------------------
Legacy supermarket endpoint handlers, organised in six Ninja Routers.

These routers serve the older authenticated supermarket application. They
are intentionally separate from the QR-based guest API in api.py, whose
identity is the active table-session token.

Connection map:
    ← models.py   : Category, Branch, Product, Cart, CartItem,
                     Order, OrderItem  (all DB queries live here)
    ← schemas.py  : every function uses In/Out schemas as type hints
    ← auth.py     : legacy `auth` (Bearer authentication) for these routers
    → api.py      : each router is imported and mounted with api.add_router()

Routers exported:
    categories_router  →  /api/categories/
    branches_router    →  /api/branches/
    products_router    →  /api/products/
    cart_router        →  /api/cart/
    orders_router      →  /api/orders/
    loyalty_router     →  /api/loyalty/
"""

from decimal import Decimal
from typing import List, Optional

from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from .auth import auth                          # ← auth.py
from core.models import (                        # ← core/models.py
    Category, Branch, Product,
    Cart, CartItem,
    Order, OrderItem,
)
from .schemas import (                          # ← schemas.py
    CategoryOut, CategoryIn,
    BranchOut, BranchIn,
    ProductOut, ProductIn, ProductUpdate, PaginatedProducts,
    CartOut, CartItemOut, CartAddSchema, CartUpdateSchema,
    OrderOut, OrderItemOut, OrderCreateSchema,
    LoyaltyCardOut,
    MessageOut,
)


# ===========================================================================
# HELPER — build CartOut from a Cart instance
# ===========================================================================
def _cart_out(cart: Cart) -> CartOut:
    items = cart.items.select_related("product").all()
    return CartOut(
        item_count=cart.item_count,
        total=cart.total,
        items=[
            CartItemOut(
                id            = i.id,
                product_id    = i.product_id,
                product_name  = i.product.name,
                product_image = i.product.image_url,
                quantity      = i.quantity,
                unit_price    = i.product.active_price,
                subtotal      = i.subtotal,
            )
            for i in items
        ],
    )


# ===========================================================================
# HELPER — build OrderOut from an Order instance
# ===========================================================================
def _order_out(order: Order) -> OrderOut:
    items = order.items.select_related("product").all()
    return OrderOut(
        id               = order.id,
        status           = order.status,
        delivery_type    = order.delivery_type,
        delivery_address = order.delivery_address,
        total_price      = order.total_price,
        delivery_fee     = order.delivery_fee,
        note             = order.note,
        created_at       = order.created_at,
        items=[
            OrderItemOut(
                product_id   = i.product_id,
                product_name = i.product.name,
                quantity     = i.quantity,
                price        = i.price,
                subtotal     = i.subtotal,
            )
            for i in items
        ],
    )


# ===========================================================================
# CATEGORIES   /api/categories/
# ===========================================================================
categories_router = Router(tags=["Categories"])


@categories_router.get("", response=List[CategoryOut], summary="List all categories")
def list_categories(request):
    return list(Category.objects.all())


@categories_router.get("/{category_id}", response=CategoryOut, summary="Get category")
def get_category(request, category_id: int):
    return get_object_or_404(Category, id=category_id)


@categories_router.post("", auth=auth, response=CategoryOut, summary="Create category [admin]")
def create_category(request, data: CategoryIn):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    return Category.objects.create(**data.dict())


@categories_router.delete("/{category_id}", auth=auth, response=MessageOut, summary="Delete category [admin]")
def delete_category(request, category_id: int):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    get_object_or_404(Category, id=category_id).delete()
    return MessageOut(message="Category deleted")


# ===========================================================================
# BRANCHES   /api/branches/
# ===========================================================================
branches_router = Router(tags=["Branches"])


@branches_router.get("", response=List[BranchOut], summary="List branches")
def list_branches(request, city: Optional[str] = None, active_only: bool = True):
    qs = Branch.objects.all()
    if active_only:
        qs = qs.filter(is_active=True)
    if city:
        qs = qs.filter(city__icontains=city)
    return list(qs)


@branches_router.get("/{branch_id}", response=BranchOut, summary="Get branch")
def get_branch(request, branch_id: int):
    return get_object_or_404(Branch, id=branch_id)


@branches_router.post("", auth=auth, response=BranchOut, summary="Create branch [admin]")
def create_branch(request, data: BranchIn):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    return Branch.objects.create(**data.dict())


@branches_router.put("/{branch_id}", auth=auth, response=BranchOut, summary="Update branch [admin]")
def update_branch(request, branch_id: int, data: BranchIn):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    branch = get_object_or_404(Branch, id=branch_id)
    for attr, value in data.dict().items():
        setattr(branch, attr, value)
    branch.save()
    return branch


# ===========================================================================
# PRODUCTS   /api/products/
# ===========================================================================
products_router = Router(tags=["Products"])


@products_router.get("", response=PaginatedProducts, summary="List products")
def list_products(
    request,
    category_id: Optional[int]     = None,
    search:      Optional[str]      = None,
    is_halal:    Optional[bool]     = None,
    is_featured: Optional[bool]     = None,
    has_discount: Optional[bool]    = None,
    min_price:   Optional[Decimal]  = None,
    max_price:   Optional[Decimal]  = None,
    page:        int                = 1,
    page_size:   int                = 20,
):
    qs = Product.objects.filter(is_available=True).select_related("category")

    if category_id:
        qs = qs.filter(category_id=category_id)
    if search:
        qs = qs.filter(name__icontains=search)
    if is_halal is not None:
        qs = qs.filter(is_halal=is_halal)
    if is_featured is not None:
        qs = qs.filter(is_featured=is_featured)
    if has_discount:
        qs = qs.filter(discount_price__isnull=False)
    if min_price is not None:
        qs = qs.filter(price__gte=min_price)
    if max_price is not None:
        qs = qs.filter(price__lte=max_price)

    count  = qs.count()
    offset = (page - 1) * page_size
    rows   = list(qs[offset: offset + page_size])

    return PaginatedProducts(
        count     = count,
        page      = page,
        page_size = page_size,
        results   = [ProductOut.from_orm(p) for p in rows],
    )


@products_router.get("/featured", response=List[ProductOut], summary="Featured products")
def featured_products(request):
    return list(Product.objects.filter(is_featured=True, is_available=True)[:12])


@products_router.get("/discounted", response=List[ProductOut], summary="Discounted products")
def discounted_products(request):
    return list(
        Product.objects.filter(discount_price__isnull=False, is_available=True)
        .order_by("-created_at")[:20]
    )


@products_router.get("/{product_id}", response=ProductOut, summary="Get product")
def get_product(request, product_id: int):
    return get_object_or_404(Product, id=product_id, is_available=True)


@products_router.post("", auth=auth, response=ProductOut, summary="Create product [admin]")
def create_product(request, data: ProductIn):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    get_object_or_404(Category, id=data.category_id)   # validate FK
    return Product.objects.create(**data.dict())


@products_router.patch("/{product_id}", auth=auth, response=ProductOut, summary="Update product [admin]")
def update_product(request, product_id: int, data: ProductUpdate):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    product = get_object_or_404(Product, id=product_id)
    for attr, value in data.dict(exclude_none=True).items():
        setattr(product, attr, value)
    product.save()
    return product


@products_router.delete("/{product_id}", auth=auth, response=MessageOut, summary="Soft-delete product [admin]")
def delete_product(request, product_id: int):
    if not request.auth.is_staff:
        raise HttpError(403, "Admin only")
    product = get_object_or_404(Product, id=product_id)
    product.is_available = False
    product.save()
    return MessageOut(message="Product deactivated")


# ===========================================================================
# CART   /api/cart/              [Auth required]
# ===========================================================================
cart_router = Router(tags=["Cart"], auth=auth)


@cart_router.get("", response=CartOut, summary="View cart")
def view_cart(request):
    cart, _ = Cart.objects.get_or_create(user=request.auth)
    return _cart_out(cart)


@cart_router.post("/add", response=CartOut, summary="Add item to cart")
def add_to_cart(request, data: CartAddSchema):
    if data.quantity < 1 or data.quantity > 100:
        raise HttpError(400, "quantity must be between 1 and 100")

    cart    = Cart.objects.get_or_create(user=request.auth)[0]
    product = get_object_or_404(Product, id=data.product_id, is_available=True)

    if data.quantity > product.stock_quantity:
        raise HttpError(400, f"Only {product.stock_quantity} in stock")

    item, created = CartItem.objects.get_or_create(cart=cart, product=product)
    item.quantity = item.quantity + data.quantity if not created else data.quantity
    item.save()
    return _cart_out(cart)


@cart_router.put("/item/{item_id}", response=CartOut, summary="Update item quantity (0 = remove)")
def update_cart_item(request, item_id: int, data: CartUpdateSchema):
    cart = Cart.objects.get_or_create(user=request.auth)[0]
    item = get_object_or_404(CartItem, id=item_id, cart=cart)

    if data.quantity == 0:
        item.delete()
    else:
        if data.quantity > item.product.stock_quantity:
            raise HttpError(400, f"Only {item.product.stock_quantity} in stock")
        item.quantity = data.quantity
        item.save()
    return _cart_out(cart)


@cart_router.delete("/clear", response=MessageOut, summary="Clear entire cart")
def clear_cart(request):
    cart = Cart.objects.get_or_create(user=request.auth)[0]
    cart.items.all().delete()
    return MessageOut(message="Cart cleared")


# ===========================================================================
# ORDERS   /api/orders/          [Auth required]
# ===========================================================================
orders_router = Router(tags=["Orders"], auth=auth)


@orders_router.post("", response=OrderOut, summary="Place order from cart")
def create_order(request, data: OrderCreateSchema):
    if data.delivery_type not in ("delivery", "pickup"):
        raise HttpError(400, "delivery_type must be 'delivery' or 'pickup'")
    if data.delivery_type == "delivery" and not data.delivery_address:
        raise HttpError(400, "delivery_address is required for home delivery")

    cart  = Cart.objects.get_or_create(user=request.auth)[0]
    items = list(cart.items.select_related("product").all())

    if not items:
        raise HttpError(400, "Cart is empty")

    # stock check
    for item in items:
        if item.quantity > item.product.stock_quantity:
            raise HttpError(400, f"Not enough stock for '{item.product.name}'")

    delivery_fee = Decimal("15000") if data.delivery_type == "delivery" else Decimal("0")
    total        = cart.total + delivery_fee

    # create order
    order = Order.objects.create(
        user             = request.auth,
        branch_id        = data.branch_id,
        status           = Order.Status.PENDING,
        delivery_type    = data.delivery_type,
        delivery_address = data.delivery_address,
        total_price      = total,
        delivery_fee     = delivery_fee,
        note             = data.note,
    )

    # create order items + decrement stock
    order_items = []
    for item in items:
        order_items.append(OrderItem(
            order    = order,
            product  = item.product,
            quantity = item.quantity,
            price    = item.product.active_price,
        ))
        item.product.stock_quantity -= item.quantity
        item.product.save()

    OrderItem.objects.bulk_create(order_items)

    # update loyalty card
    try:
        lc = request.auth.loyalty_card
        lc.total_spent  += order.total_price
        lc.bonus_points += int(order.total_price * lc.cashback_percent / 100)
        lc.save()
    except Exception:
        pass

    # clear cart
    cart.items.all().delete()

    # reload order with items for response
    order.refresh_from_db()
    return _order_out(order)


@orders_router.get("", response=List[OrderOut], summary="My orders")
def list_orders(request):
    orders = Order.objects.filter(user=request.auth).prefetch_related("items__product")
    return [_order_out(o) for o in orders]


@orders_router.get("/{order_id}", response=OrderOut, summary="Order detail")
def get_order(request, order_id: int):
    order = get_object_or_404(Order, id=order_id, user=request.auth)
    return _order_out(order)


@orders_router.post("/{order_id}/cancel", response=MessageOut, summary="Cancel order")
def cancel_order(request, order_id: int):
    order = get_object_or_404(Order, id=order_id, user=request.auth)
    if order.status not in (Order.Status.PENDING, Order.Status.CONFIRMED):
        raise HttpError(400, "Order cannot be cancelled at this stage")
    order.status = Order.Status.CANCELLED
    order.save()
    return MessageOut(message="Order cancelled")


# ===========================================================================
# LOYALTY CARD   /api/loyalty/   [Auth required]
# ===========================================================================
loyalty_router = Router(tags=["Loyalty"], auth=auth)


@loyalty_router.get("", response=LoyaltyCardOut, summary="My loyalty card")
def get_loyalty_card(request):
    try:
        lc = request.auth.loyalty_card
        return LoyaltyCardOut(
            card_number      = lc.card_number,
            bonus_points     = lc.bonus_points,
            total_spent      = lc.total_spent,
            cashback_percent = lc.cashback_percent,
        )
    except Exception:
        raise HttpError(404, "Loyalty card not found")