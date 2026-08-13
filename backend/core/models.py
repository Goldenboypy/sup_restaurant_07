"""
core/models.py
---------------------
All database models for the project.

This file now covers TWO generations of the product, kept side by side
on purpose:

  SECTION 1 -- EXISTING MODELS (unchanged, still fully in charge of
               everything they already do: catalog, cart, checkout,
               delivery/pickup orders, loyalty). Nothing below was
               removed, renamed, or altered in any way.

  SECTION 2 -- NEW MODELS added for the dine-in Guest/Staff redesign
               sessions, waiter assignment, kitchen tickets, and the
               guest ordering/payment flow.

Why nothing collides:
  Both generations originally defined a model called `Order`, an
  `OrderItem`, and a `LoyaltyCard`. Section 1's versions are untouched
  and remain exactly as they were -- they are still what every existing
  consumer (schemas.py, routers.py, auth.py, seed_data.py) talks to.
  Section 2's dine-in order models were renamed to `RestaurantOrder`
  and `RestaurantOrderItem` so both can live in the same module without
  either one shadowing or breaking the other. Section 2's loyalty
  program was NOT re-created -- it simply reuses the existing
  `LoyaltyCard` model below, since that model already does the job
  (cashback tiers) for any authenticated user, dine-in or not.
  Because Django derives each model's DB table name from its class
  name, `Order` -> `core_order` and `RestaurantOrder` ->
  `core_restaurantorder` are already two separate tables -- no
  migration conflict either.

Connection map:
    <- settings.py  : INSTALLED_APPS = ["core"]  registers every model below
    <- guest_api/*  : reads/writes Section 2 models only (never Section 1)
    <- staff_api/*  : reads/writes Section 2 models only (never Section 1)
    <- schemas.py, routers.py, auth.py, seed_data.py (existing) : Section 1 only
"""

import uuid
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models


# ===========================================================================
# SECTION 1 -- EXISTING MODELS (verbatim, unchanged)
# ===========================================================================

# ---------------------------------------------------------------------------
# CATEGORY
# ---------------------------------------------------------------------------
class Category(models.Model):
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon        = models.CharField(max_length=50, blank=True, help_text="Emoji icon")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# BRANCH  (store location)
# ---------------------------------------------------------------------------
class Branch(models.Model):
    name         = models.CharField(max_length=150)
    city         = models.CharField(max_length=100)
    address      = models.TextField()
    phone        = models.CharField(max_length=20)
    latitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude    = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_open_24h  = models.BooleanField(default=False)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Branches"

    def __str__(self):
        return f"{self.name} — {self.city}"


# ---------------------------------------------------------------------------
# PRODUCT
# ---------------------------------------------------------------------------
class Product(models.Model):
    # FK → Category
    category       = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="products"
    )
    name           = models.CharField(max_length=200)
    slug           = models.SlugField(unique=True)
    description    = models.TextField(blank=True)
    price          = models.DecimalField(max_digits=12, decimal_places=2)
    discount_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    unit           = models.CharField(max_length=20, default="dona", help_text="kg / litr / dona")
    barcode        = models.CharField(max_length=50, blank=True)
    brand          = models.CharField(max_length=100, blank=True)
    image_url      = models.URLField(blank=True)
    is_available   = models.BooleanField(default=True)
    is_halal       = models.BooleanField(default=False)
    is_featured    = models.BooleanField(default=False)
    stock_quantity = models.PositiveIntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    # ── computed helpers used by schemas.py ──────────────────────────────────
    @property
    def active_price(self):
        """Returns discount_price if set, otherwise regular price."""
        return self.discount_price if self.discount_price else self.price

    @property
    def discount_percent(self):
        """Percentage off compared to the original price."""
        if self.discount_price and self.price > 0:
            return int((1 - self.discount_price / self.price) * 100)
        return 0


# ---------------------------------------------------------------------------
# CART  (one per user)
# ---------------------------------------------------------------------------
class Cart(models.Model):
    # OneToOne → Django User
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name="cart")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s cart"

    @property
    def total(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def item_count(self):
        return self.items.count()


# ---------------------------------------------------------------------------
# CART ITEM
# ---------------------------------------------------------------------------
class CartItem(models.Model):
    # FK → Cart
    cart     = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    # FK → Product
    product  = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("cart", "product")

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"

    @property
    def subtotal(self):
        if self.product is None or self.quantity is None:
            return Decimal("0.00")
        return self.product.active_price * self.quantity


# ---------------------------------------------------------------------------
# ORDER
# ---------------------------------------------------------------------------
class Order(models.Model):

    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PREPARING = "preparing", "Preparing"
        SHIPPED   = "shipped",   "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    class DeliveryType(models.TextChoices):
        DELIVERY = "delivery", "Home delivery"
        PICKUP   = "pickup",   "Store pickup"

    # FK → User
    user             = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    # FK → Branch (optional — used for pickup)
    branch           = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    delivery_type    = models.CharField(max_length=20, choices=DeliveryType.choices, default=DeliveryType.DELIVERY)
    delivery_address = models.TextField(blank=True)
    total_price      = models.DecimalField(max_digits=14, decimal_places=2)
    delivery_fee     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    note             = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id} — {self.user.username}"


# ---------------------------------------------------------------------------
# ORDER ITEM
# ---------------------------------------------------------------------------
class OrderItem(models.Model):
    # FK → Order
    order    = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    # FK → Product
    product  = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    price    = models.DecimalField(max_digits=12, decimal_places=2)  # price at purchase time

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"

    @property
    def subtotal(self):
        if self.price is None or self.quantity is None:
            return Decimal("0.00")
        return self.price * self.quantity


# ---------------------------------------------------------------------------
# LOYALTY CARD
# ---------------------------------------------------------------------------
class LoyaltyCard(models.Model):
    # OneToOne → Django User
    user          = models.OneToOneField(User, on_delete=models.CASCADE, related_name="loyalty_card")
    card_number   = models.CharField(max_length=16, unique=True)
    bonus_points  = models.PositiveIntegerField(default=0)
    total_spent   = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    created_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} — {self.card_number}"

    @property
    def cashback_percent(self):
        """
        Tier system:
            total_spent <  1,300,000 UZS  → 1%
            total_spent >= 1,300,000 UZS  → 3%
            total_spent >= 5,000,000 UZS  → 5%
        """
        if self.total_spent >= 5_000_000:
            return 5
        elif self.total_spent >= 1_300_000:
            return 3
        return 1


# ===========================================================================
# SECTION 2 -- NEW MODELS (dine-in Guest/Staff redesign, v2-v5)
#
# Nothing above this line was touched. Everything below is additive: new
# tables, own FKs, own related_names -- it only activates when guest_api/
# or staff_api/ actually calls it, and never intercepts or runs ahead of
# Section 1's models, views, or signals.
# ===========================================================================

# ---------------------------------------------------------------------------
# WAITER
# ---------------------------------------------------------------------------
class Waiter(models.Model):
    """A staff member who can be assigned to tables and confirm orders.

    Deliberately separate from a regular customer `User` (Section 1's
    Cart/Order/LoyaltyCard flow) -- a Waiter is staff, authenticated via
    staff_api's Bearer-token auth, and never touches the customer cart.
    """

    # OneToOne → Django User (same User model Section 1 already uses)
    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name="waiter_profile")
    display_name = models.CharField(max_length=80)

    def __str__(self):
        return self.display_name


# ---------------------------------------------------------------------------
# MENU CATEGORY   (dine-in menu, distinct from Section 1's Category)
# ---------------------------------------------------------------------------
class MenuCategory(models.Model):
    name           = models.CharField(max_length=80)
    slug           = models.SlugField(unique=True)
    display_order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "name"]
        verbose_name_plural = "menu categories"

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# MENU ITEM   (dine-in menu, distinct from Section 1's Product)
# ---------------------------------------------------------------------------
class MenuItem(models.Model):
    # FK → MenuCategory
    category          = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name="items")
    name              = models.CharField(max_length=120)
    description       = models.TextField(blank=True)
    ingredients       = models.JSONField(default=list)  # e.g. ["tomato", "mozzarella", "basil"]
    price             = models.DecimalField(max_digits=8, decimal_places=2)
    photo             = models.ImageField(upload_to="menu_items/", blank=True, null=True)
    is_vegan          = models.BooleanField(default=False)
    is_spicy          = models.BooleanField(default=False)
    is_available_now  = models.BooleanField(default=True)

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# TABLE
# ---------------------------------------------------------------------------
class Table(models.Model):
    class Status(models.TextChoices):
        FREE           = "free",           "Free"
        OCCUPIED       = "occupied",       "Occupied"
        BILL_REQUESTED = "bill_requested", "Bill requested"

    number           = models.PositiveSmallIntegerField(unique=True)
    seats            = models.PositiveSmallIntegerField(default=2)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.FREE)
    # FK → Waiter (optional — unassigned until a waiter claims the table)
    assigned_waiter  = models.ForeignKey(
        Waiter, on_delete=models.SET_NULL, null=True, blank=True, related_name="tables"
    )
    qr_token         = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    def __str__(self):
        return f"Table {self.number}"


# ---------------------------------------------------------------------------
# TABLE SESSION   (one guest visit at one table)
# ---------------------------------------------------------------------------
class TableSession(models.Model):
    """Created the moment a guest scans the table's QR code."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    # FK → Table
    table          = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="sessions")
    session_token  = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    started_at     = models.DateTimeField(auto_now_add=True)
    ended_at       = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.session_token} @ Table {self.table.number}"


# ---------------------------------------------------------------------------
# RESTAURANT ORDER   (renamed from "Order" to avoid clashing with Section 1)
# ---------------------------------------------------------------------------
class RestaurantOrder(models.Model):
    """A dine-in order tied to a TableSession -- NOT the same thing as
    Section 1's `Order` (delivery/pickup). Renamed on purpose so both
    models -- and both tables in the database -- can coexist."""

    class Status(models.TextChoices):
        SUBMITTED            = "submitted",            "Submitted"
        WAITER_CONFIRMED     = "waiter_confirmed",      "Waiter confirmed"
        KITCHEN_IN_PROGRESS  = "kitchen_in_progress",   "Kitchen in progress"
        READY                = "ready",                 "Ready"
        SERVED               = "served",                "Served"

    # FK → TableSession
    session             = models.ForeignKey(TableSession, on_delete=models.CASCADE, related_name="orders")
    status               = models.CharField(max_length=24, choices=Status.choices, default=Status.SUBMITTED)
    submitted_at          = models.DateTimeField(auto_now_add=True)

    confirmed_by_waiter    = models.BooleanField(default=False)
    confirmed_at            = models.DateTimeField(null=True, blank=True)
    # FK → Waiter
    confirmed_by             = models.ForeignKey(
        Waiter, on_delete=models.SET_NULL, null=True, blank=True, related_name="confirmed_orders"
    )

    served_at                 = models.DateTimeField(null=True, blank=True)
    # FK → Waiter
    served_by                  = models.ForeignKey(
        Waiter, on_delete=models.SET_NULL, null=True, blank=True, related_name="served_orders"
    )

    @property
    def total_price(self) -> Decimal:
        """Only ever read by staff_api / the guest's post-payment Bill view."""
        return sum(
            (item.menu_item.price * item.quantity for item in self.items.all()),
            Decimal("0.00"),
        )

    def __str__(self):
        return f"RestaurantOrder #{self.pk} ({self.status})"


# ---------------------------------------------------------------------------
# RESTAURANT ORDER ITEM   (renamed from "OrderItem" to avoid clashing)
# ---------------------------------------------------------------------------
class RestaurantOrderItem(models.Model):
    # FK → RestaurantOrder
    order                 = models.ForeignKey(RestaurantOrder, on_delete=models.CASCADE, related_name="items")
    # FK → MenuItem
    menu_item              = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity                 = models.PositiveSmallIntegerField(default=1)
    excluded_ingredients       = models.JSONField(default=list, blank=True)  # e.g. ["tomato"]

    def __str__(self):
        return f"{self.quantity}x {self.menu_item.name}"


# ---------------------------------------------------------------------------
# KITCHEN TICKET
# ---------------------------------------------------------------------------
class KitchenTicket(models.Model):
    class Status(models.TextChoices):
        NEW         = "new",         "New"
        IN_PROGRESS = "in_progress", "In progress"
        READY       = "ready",       "Ready"

    # FK → RestaurantOrder
    order        = models.OneToOneField(RestaurantOrder, on_delete=models.CASCADE, related_name="ticket")
    status        = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    created_at     = models.DateTimeField(auto_now_add=True)
    completed_at    = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Ticket for RestaurantOrder #{self.order_id} ({self.status})"


# ---------------------------------------------------------------------------
# PAYMENT REQUEST
# ---------------------------------------------------------------------------
class PaymentRequest(models.Model):
    class Method(models.TextChoices):
        CARD = "card", "Card"
        CASH = "cash", "Cash"

    # OneToOne → TableSession
    session        = models.OneToOneField(TableSession, on_delete=models.CASCADE, related_name="payment_request")
    method          = models.CharField(max_length=4, choices=Method.choices)
    requested_at     = models.DateTimeField(auto_now_add=True)
    completed_at      = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Payment for session {self.session_id} ({self.method})"

# NOTE: no new LoyaltyCard model here on purpose -- Section 1's LoyaltyCard
# (above) already covers cashback for any authenticated User, dine-in
# guests included, so it is reused as-is rather than duplicated.