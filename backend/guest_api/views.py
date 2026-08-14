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



def home(request: HttpRequest):
    return render(request, "guest/home.html", {
        "page":                "home",
        "featured_products":   Product.objects.filter(is_featured=True,  is_available=True).select_related("category")[:8],
        "discounted_products": Product.objects.filter(discount_price__isnull=False, is_available=True).select_related("category")[:8],
        "categories":          Category.objects.all(),
        "branch_count":        Branch.objects.filter(is_active=True).count(),
        "product_count":       Product.objects.filter(is_available=True).count(),
    })


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

    # Optional: if the QR token is present in the query string (?qr=<token>),
    # resolve the Table and ensure a TableSession exists so the rendered page
    # can include a guest session token. This lets the client JS attach
    # X-Table-Session and call /api/guest/* endpoints without returning 401.
    qr = request.GET.get("qr")
    if qr:
        try:
            qr_uuid = UUID(qr)
            table = Table.objects.filter(qr_token=qr_uuid).first()
            if table:
                session = (
                    TableSession.objects
                    .filter(table=table, status=TableSession.Status.ACTIVE)
                    .order_by("-started_at")
                    .first()
                )
                if session is None:
                    session = TableSession.objects.create(table=table)
                context["session_token"] = str(session.session_token)
        except Exception:
            # Silently ignore malformed tokens or DB errors — page still loads.
            pass

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

#def cart_view(request: HttpRequest):
#    return render(request, "base.html", {"page": "cart"})    


def orders_view(request: HttpRequest):
    context = {"page": "orders"}

    qr = request.GET.get("qr")
    if qr:
        try:
            qr_uuid = UUID(qr)
            table = Table.objects.filter(qr_token=qr_uuid).first()
            if table:
                session = (
                    TableSession.objects
                    .filter(table=table, status=TableSession.Status.ACTIVE)
                    .order_by("-started_at")
                    .first()
                )
                if session is None:
                    session = TableSession.objects.create(table=table)
                context["session_token"] = str(session.session_token)
        except Exception:
            pass

    return render(request, "guest/orders.html", context)

def order_confirmed_view(request: HttpRequest):
    return render(request, "guest/order_confirmed.html", {"page": "order_confirmed"})