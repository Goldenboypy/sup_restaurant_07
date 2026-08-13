"""
core/admin.py
--------------------
Registers all models in Django's built-in admin panel.

Connection map:
    <- models.py  : SECTION 1 (existing) -- Category, Branch, Product, Cart,
                     CartItem, Order, OrderItem, LoyaltyCard
                     SECTION 2 (new)      -- Waiter, MenuCategory, MenuItem,
                     Table, TableSession, RestaurantOrder, RestaurantOrderItem,
                     KitchenTicket, PaymentRequest
    -> config/settings.py : INSTALLED_APPS has "django.contrib.admin"
                            which activates this file automatically

Access: http://localhost:8000/admin/
Login : superuser created by `python manage.py seed_data` (see that
        command's --help; credentials are env-var driven, not hardcoded)

Why Table (and the rest of Section 2) is registered here at all:
    Per the seed_data.py redesign, menu/catalog content -- and now table
    and order administration -- is managed by staff through this admin
    panel, not baked into a seed script. The Staff App's own UI covers
    day-to-day table/order operation (assigning a waiter, opening a QR,
    confirming an order); this admin panel is the equivalent
    superuser-level view for setup, troubleshooting and bulk edits --
    e.g. adding a table before it has a QR scanned, or correcting a
    stuck order status by hand.
"""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    Category,
    Branch,
    Product,
    Cart,
    CartItem,
    Order,
    OrderItem,
    LoyaltyCard,
    Waiter,
    MenuCategory,
    MenuItem,
    Table,
    TableSession,
    RestaurantOrder,
    RestaurantOrderItem,
    KitchenTicket,
    PaymentRequest,
)


# ===========================================================================
# SECTION 1 -- EXISTING ADMIN REGISTRATIONS (verbatim, unchanged)
# ===========================================================================

# ===========================================================================
# CATEGORY
# ===========================================================================
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ("id", "icon", "name", "slug", "product_count", "created_at")
    list_display_links = ("id", "name")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("name",)

    @admin.display(description="Products")
    def product_count(self, obj):
        return obj.products.count()


# ===========================================================================
# BRANCH
# ===========================================================================
@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display  = ("id", "name", "city", "phone", "is_open_24h", "is_active")
    list_display_links = ("id", "name")
    list_filter   = ("city", "is_open_24h", "is_active")
    search_fields = ("name", "city", "address")
    list_editable = ("is_active",)
    ordering      = ("city", "name")


# ===========================================================================
# PRODUCT
# ===========================================================================
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "name", "category", "price_display",
        "discount_display", "unit", "stock_quantity",
        "is_halal", "is_featured", "is_available",
    )
    list_display_links = ("id", "name")
    list_filter   = ("category", "is_halal", "is_featured", "is_available", "brand")
    search_fields = ("name", "slug", "barcode", "brand")
    list_editable = ("is_featured", "is_available", "stock_quantity")
    prepopulated_fields = {"slug": ("name",)}
    ordering      = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "active_price", "discount_percent")

    fieldsets = (
        ("Basic Info", {
            "fields": ("category", "name", "slug", "description", "brand", "barcode", "image_url")
        }),
        ("Pricing", {
            "fields": ("price", "discount_price", "active_price", "discount_percent", "unit")
        }),
        ("Stock & Visibility", {
            "fields": ("stock_quantity", "is_available", "is_halal", "is_featured")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Price (UZS)")
    def price_display(self, obj):
        return f"{obj.price:,.0f}"

    @admin.display(description="Discount")
    def discount_display(self, obj):
        if obj.discount_price:
            return format_html(
                '<span style="color:green;">-{}% → {}</span>',
                obj.discount_percent,
                f"{obj.discount_price:,.0f}",
            )
        return "—"


# ===========================================================================
# CART  (inline CartItems)
# ===========================================================================
class CartItemInline(admin.TabularInline):
    model  = CartItem
    extra  = 0
    fields = ("product", "quantity", "subtotal_display")
    readonly_fields = ("subtotal_display",)

    @admin.display(description="Subtotal (UZS)")
    def subtotal_display(self, obj):
        return f"{obj.subtotal:,.0f}"


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display  = ("id", "user", "item_count", "total_display", "updated_at")
    list_display_links = ("id", "user")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")
    inlines = [CartItemInline]

    @admin.display(description="Items")
    def item_count(self, obj):
        return obj.item_count

    @admin.display(description="Total (UZS)")
    def total_display(self, obj):
        return f"{obj.total:,.0f}"


# ===========================================================================
# ORDER  (inline OrderItems)
# ===========================================================================
class OrderItemInline(admin.TabularInline):
    model  = OrderItem
    extra  = 0
    fields = ("product", "quantity", "price", "subtotal_display")
    readonly_fields = ("subtotal_display",)

    @admin.display(description="Subtotal (UZS)")
    def subtotal_display(self, obj):
        return f"{obj.subtotal:,.0f}"


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "user", "status_badge", "delivery_type",
        "total_price_display", "delivery_fee", "created_at",
    )
    list_display_links = ("id", "user")
    list_filter   = ("status", "delivery_type", "created_at")
    search_fields = ("user__username", "delivery_address", "note")
    list_editable = ("delivery_type",)
    ordering      = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [OrderItemInline]

    fieldsets = (
        ("Order Info", {
            "fields": ("user", "branch", "status", "note")
        }),
        ("Delivery", {
            "fields": ("delivery_type", "delivery_address", "delivery_fee")
        }),
        ("Pricing", {
            "fields": ("total_price",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    STATUS_COLORS = {
        "pending":   "#f59e0b",
        "confirmed": "#3b82f6",
        "preparing": "#8b5cf6",
        "shipped":   "#06b6d4",
        "delivered": "#10b981",
        "cancelled": "#ef4444",
    }

    @admin.display(description="Status")
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Total (UZS)")
    def total_price_display(self, obj):
        return f"{obj.total_price:,.0f}"


# ===========================================================================
# LOYALTY CARD
# ===========================================================================
@admin.register(LoyaltyCard)
class LoyaltyCardAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "user", "card_number",
        "bonus_points", "total_spent_display", "cashback_display", "created_at",
    )
    list_display_links = ("id", "user")
    search_fields = ("user__username", "card_number")
    readonly_fields = ("card_number", "created_at", "cashback_percent")
    ordering = ("-total_spent",)

    @admin.display(description="Total Spent (UZS)")
    def total_spent_display(self, obj):
        return f"{obj.total_spent:,.0f}"

    @admin.display(description="Cashback")
    def cashback_display(self, obj):
        percent = obj.cashback_percent
        color = "#10b981" if percent == 5 else "#3b82f6" if percent == 3 else "#6b7280"
        return format_html(
            '<span style="color:{};font-weight:bold;">{}%</span>',
            color,
            percent,
        )


# ===========================================================================
# SECTION 2 -- NEW ADMIN REGISTRATIONS (dine-in Guest/Staff redesign)
#
# Nothing above this line was touched. Everything below is additive, for
# the models that had no admin section at all -- most importantly Table,
# which the Staff App depends on existing and being assignable/searchable.
# ===========================================================================

# ===========================================================================
# WAITER
# ===========================================================================
@admin.register(Waiter)
class WaiterAdmin(admin.ModelAdmin):
    list_display  = ("id", "display_name", "user", "assigned_table_count")
    list_display_links = ("id", "display_name")
    search_fields = ("display_name", "user__username", "user__email")
    ordering = ("display_name",)

    @admin.display(description="Tables")
    def assigned_table_count(self, obj):
        return obj.tables.count()


# ===========================================================================
# MENU CATEGORY
# ===========================================================================
@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display  = ("id", "name", "slug", "display_order", "item_count")
    list_display_links = ("id", "name")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    list_editable = ("display_order",)
    ordering = ("display_order", "name")

    @admin.display(description="Items")
    def item_count(self, obj):
        return obj.items.count()


# ===========================================================================
# MENU ITEM
# ===========================================================================
@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "name", "category", "price_display",
        "is_vegan", "is_spicy", "is_available_now",
    )
    list_display_links = ("id", "name")
    list_filter   = ("category", "is_vegan", "is_spicy", "is_available_now")
    search_fields = ("name", "description")
    list_editable = ("is_available_now",)
    ordering      = ("category", "name")
    readonly_fields = ("ingredients_preview",)

    fieldsets = (
        ("Basic Info", {
            "fields": ("category", "name", "description", "photo")
        }),
        ("Ingredients", {
            "fields": ("ingredients", "ingredients_preview"),
            "description": 'Enter as a JSON list, e.g. ["tomato", "mozzarella", "basil"]. '
                            "This is what the Guest App's Configure Order checklist reads from.",
        }),
        ("Pricing & Flags", {
            "fields": ("price", "is_vegan", "is_spicy", "is_available_now")
        }),
    )

    @admin.display(description="Price")
    def price_display(self, obj):
        return f"{obj.price:,.2f}"

    @admin.display(description="Ingredients")
    def ingredients_preview(self, obj):
        return ", ".join(obj.ingredients) if obj.ingredients else "—"


# ===========================================================================
# TABLE  -- the section the Staff App needs to select/operate on tables
# ===========================================================================
@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "number", "seats", "status_badge",
        "assigned_waiter", "qr_token_short", "active_session_link",
    )
    list_display_links = ("id", "number")
    list_filter   = ("status", "assigned_waiter")
    search_fields = ("number", "assigned_waiter__display_name")
    list_editable = ("seats",)
    ordering      = ("number",)
    readonly_fields = ("qr_token", "qr_code_preview")

    fieldsets = (
        ("Table Info", {
            "fields": ("number", "seats", "status", "assigned_waiter")
        }),
        ("QR Code", {
            "fields": ("qr_token", "qr_code_preview"),
            "description": "Guests scan this to open the Guest App menu for this table.",
        }),
    )

    STATUS_COLORS = {
        "free":           "#10b981",
        "occupied":       "#f59e0b",
        "bill_requested": "#ef4444",
    }

    @admin.display(description="Status")
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="QR token")
    def qr_token_short(self, obj):
        return f"{str(obj.qr_token)[:8]}…"

    @admin.display(description="QR code")
    def qr_code_preview(self, obj):
        guest_url = f"https://guest.example.com/t/{obj.qr_token}"
        return format_html(
            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data={}" '
            'alt="QR code for Table {}"/><br><a href="{}" target="_blank">{}</a>',
            guest_url, obj.number, guest_url, guest_url,
        )

    @admin.display(description="Active session")
    def active_session_link(self, obj):
        session = obj.sessions.filter(status=TableSession.Status.ACTIVE).first()
        if not session:
            return "—"
        url = reverse("admin:core_tablesession_change", args=[session.pk])
        return format_html('<a href="{}">{}</a>', url, str(session.session_token)[:8] + "…")


# ===========================================================================
# TABLE SESSION  (inline RestaurantOrders for that visit)
# ===========================================================================
class RestaurantOrderInline(admin.TabularInline):
    model = RestaurantOrder
    extra = 0
    fields = ("id", "status", "confirmed_by_waiter", "served_by", "submitted_at")
    readonly_fields = ("id", "submitted_at")
    show_change_link = True


@admin.register(TableSession)
class TableSessionAdmin(admin.ModelAdmin):
    list_display  = ("id", "table", "session_token_short", "status_badge", "started_at", "ended_at")
    list_display_links = ("id", "table")
    list_filter   = ("status", "table")
    search_fields = ("session_token", "table__number")
    readonly_fields = ("session_token", "started_at")
    ordering      = ("-started_at",)
    inlines = [RestaurantOrderInline]

    STATUS_COLORS = {"active": "#10b981", "closed": "#6b7280"}

    @admin.display(description="Status")
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Session token")
    def session_token_short(self, obj):
        return f"{str(obj.session_token)[:8]}…"


# ===========================================================================
# RESTAURANT ORDER  (inline RestaurantOrderItems)
# ===========================================================================
class RestaurantOrderItemInline(admin.TabularInline):
    model = RestaurantOrderItem
    extra = 0
    fields = ("menu_item", "quantity", "exclusions_display")
    readonly_fields = ("exclusions_display",)

    @admin.display(description="Exclusions")
    def exclusions_display(self, obj):
        return ", ".join(obj.excluded_ingredients) if obj.excluded_ingredients else "—"


@admin.register(RestaurantOrder)
class RestaurantOrderAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "table_number", "status_badge", "confirmed_by_waiter",
        "served_by", "total_price_display", "submitted_at",
    )
    list_display_links = ("id",)
    list_filter   = ("status", "confirmed_by_waiter")
    search_fields = ("session__table__number", "session__session_token")
    readonly_fields = ("submitted_at", "confirmed_at", "served_at", "total_price_display")
    ordering      = ("-submitted_at",)
    inlines = [RestaurantOrderItemInline]

    fieldsets = (
        ("Order Info", {
            "fields": ("session", "status", "total_price_display")
        }),
        ("Waiter Confirmation", {
            "fields": ("confirmed_by_waiter", "confirmed_by", "confirmed_at")
        }),
        ("Serving", {
            "fields": ("served_by", "served_at")
        }),
    )

    STATUS_COLORS = {
        "submitted":            "#f59e0b",
        "waiter_confirmed":     "#3b82f6",
        "kitchen_in_progress":  "#8b5cf6",
        "ready":                "#06b6d4",
        "served":               "#10b981",
    }

    @admin.display(description="Table")
    def table_number(self, obj):
        return obj.session.table.number

    @admin.display(description="Status")
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Total")
    def total_price_display(self, obj):
        return f"{obj.total_price:,.2f}"


# ===========================================================================
# KITCHEN TICKET
# ===========================================================================
@admin.register(KitchenTicket)
class KitchenTicketAdmin(admin.ModelAdmin):
    list_display  = ("id", "order_link", "status_badge", "created_at", "completed_at")
    list_display_links = ("id",)
    list_filter   = ("status",)
    search_fields = ("order__session__table__number",)
    readonly_fields = ("created_at", "completed_at")
    ordering      = ("-created_at",)

    STATUS_COLORS = {"new": "#f59e0b", "in_progress": "#3b82f6", "ready": "#10b981"}

    @admin.display(description="Order")
    def order_link(self, obj):
        url = reverse("admin:core_restaurantorder_change", args=[obj.order_id])
        return format_html(
            '<a href="{}">Order #{} (Table {})</a>',
            url, obj.order_id, obj.order.session.table.number,
        )

    @admin.display(description="Status")
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display(),
        )


# ===========================================================================
# PAYMENT REQUEST
# ===========================================================================
@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display  = ("id", "table_number", "method", "requested_at", "completed_at", "is_completed")
    list_display_links = ("id",)
    list_filter   = ("method",)
    search_fields = ("session__table__number",)
    readonly_fields = ("requested_at",)
    ordering      = ("-requested_at",)

    @admin.display(description="Table")
    def table_number(self, obj):
        return obj.session.table.number

    @admin.display(boolean=True, description="Completed")
    def is_completed(self, obj):
        return obj.completed_at is not None


# ===========================================================================
# Admin site branding
# ===========================================================================
admin.site.site_header  = "Guest API Admin"
admin.site.site_title   = "Guest API Admin"
admin.site.index_title  = "Welcome to Guest API Admin Panel"