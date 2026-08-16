"""
guest_api/views.py
--------------------
HTML page views — each returns a rendered template.

Connection map:
    <- models.py        : Product, Category, Branch
    -> config/urls.py   : all path() entries point here
    -> frontend/templates/base.html    : extended by all pages
    -> frontend/templates/home.html    : rendered by home()
    -> frontend/templates/auth.html    : rendered by auth_view()
    -> frontend/templates/cart.html    : rendered by cart_view()
    -> frontend/templates/orders.html  : rendered by orders_view()
    -> frontend/templates/products.html: rendered by menu_view()
"""

from django.shortcuts import render, get_object_or_404, redirect
import json
from uuid import UUID
from core.models import Table, TableSession
from django.http import HttpRequest
from core.models import Product, Category, Branch, Cart, CartItem

from staff_api.views import resolve_active_session_for_qr


def home(request: HttpRequest):
    context = {
        "page":                "home",
        "featured_products":   Product.objects.filter(is_featured=True, is_available=True).select_related("category")[:8],
        "discounted_products": Product.objects.filter(discount_price__isnull=False, is_available=True).select_related("category")[:8],
        "categories":          Category.objects.all(),
        "branch_count":        Branch.objects.filter(is_active=True).count(),
        "product_count":       Product.objects.filter(is_available=True).count(),
    }

    qr = request.GET.get("qr")
    if qr:
        table, session = resolve_active_session_for_qr(qr)
        if table and session:
            context["session_token"] = str(session.session_token)
        elif table and not session:
            return render(request, "guest/table_closed.html", {
                "page": "table_closed",
                "table_number": table.number,
            })

    return render(request, "guest/home.html", context)


def auth_view(request: HttpRequest):
    return render(request, "guest/auth.html", {"page": "auth"})


def menu_view(request: HttpRequest):
    return render(request, "guest/products.html", {
        "page":            "menu",
        "categories":      Category.objects.all(),
        "selected_category": None,
        "products":        None,
    })


def category_view(request: HttpRequest, category_slug: str):
    category = get_object_or_404(Category, slug=category_slug)
    products = (
        Product.objects
        .filter(category=category, is_available=True)
        .select_related("category")
        .order_by("name")
    )
    return render(request, "guest/products.html", {
        "page":             "menu",
        "categories":       Category.objects.all(),
        "selected_category": category,
        "products":         products,
    })


def product_detail_view(request: HttpRequest, product_id: int):
    product = get_object_or_404(Product, id=product_id, is_available=True)
    # Prepare server-rendered product payload so legacy templates can show
    # the product immediately without relying on the guest API mapping.
    try:
        price_val = float(product.price)
    except Exception:
        price_val = None

    product_payload = {
        "id": product.id,
        "name": product.name,
        "image_url": product.image_url or "",
        "price": price_val,
        "active_price": float(product.discount_price) if product.discount_price is not None else price_val,
        "unit": product.unit,
        "description": product.description or "",
        "stock_quantity": product.stock_quantity,
    }

    context = {
        "page":          "menu",
        "product_id":    product.id,
        "product":       product_payload,
        "product_json":  json.dumps(product_payload),
        "back_url":      f"/menu/{product.category.slug}/",
        "category_name": product.category.name,
    }

    # If the QR token is present in the query string (?qr=<token>), only
    # attach a session if the table's ordering window is currently open
    # (an ACTIVE TableSession already exists). Never auto-create one here —
    # only staff can open ordering for a table (see table_detail's
    # 'open_ordering' action). This stops a photographed/reused QR code
    # from working outside a waiter-opened window.
    qr = request.GET.get("qr")
    if qr:
        table, session = resolve_active_session_for_qr(qr)
        if table and session:
            context["session_token"] = str(session.session_token)
        elif table and not session:
            return render(request, "guest/table_closed.html", {
                "page": "table_closed",
                "table_number": table.number,
            })

    return render(request, "guest/product_detail.html", context)


def configure_order_view(request: HttpRequest, product_id: int):
    product = get_object_or_404(Product, id=product_id, is_available=True)
    ingredients = [item.strip() for item in (product.description or "").split(",") if item.strip()][:8]

    if request.method == "POST":
        if not request.user.is_authenticated:
            return redirect(f"/login/?next=/product/{product.id}/configure/")

        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item, created = CartItem.objects.get_or_create(cart=cart, product=product)
        cart_item.quantity = cart_item.quantity + 1 if not created else 1
        cart_item.save()
        return redirect("/cart/")

    return render(request, "guest/configure_order.html", {
        "page":        "menu",
        "product":     product,
        "ingredients": ingredients,
        "back_url":    f"/product/{product.id}/",
    })


def cart_view(request: HttpRequest):
    return render(request, "guest/cart.html", {"page": "cart"})


def orders_view(request: HttpRequest):
    context = {"page": "orders"}

    qr = request.GET.get("qr")
    if qr:
        table, session = resolve_active_session_for_qr(qr)
        if table and session:
            context["session_token"] = str(session.session_token)
        elif table and not session:
            return render(request, "guest/table_closed.html", {
                "page": "table_closed",
                "table_number": table.number,
            })

    return render(request, "guest/orders.html", context)


def order_confirmed_view(request: HttpRequest):
    return render(request, "guest/order_confirmed.html", {"page": "order_confirmed"})