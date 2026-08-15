"""
config/urls.py
--------------
Root URL dispatcher.

/              -> guest_api/views.py :: home          (homepage)
/login/        -> guest_api/views.py :: auth_view     (login + register)
/shop/         -> guest_api/views.py :: shop_view     (product listing)
/cart/         -> guest_api/views.py :: cart_view     (shopping cart)
/orders/       -> guest_api/views.py :: orders_view   (order history)
/admin/        -> Django admin panel
/api/          -> NinjaAPI
                  /api/docs            Swagger UI
                  /api/auth/           auth.py
                  /api/products/       routers.py
                  /api/categories/     routers.py
                  /api/branches/       routers.py
                  /api/cart/           routers.py
                  /api/orders/         routers.py
                  /api/loyalty/        routers.py
"""

from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import path

from guest_api.views import (
    home,
    auth_view,
    menu_view,
    cart_view,
    orders_view,
    order_confirmed_view,
    category_view,
    product_detail_view,
    configure_order_view,
)

from guest_api.api import api
from staff_api.api import api as staff_api
from staff_api.views import StaffLoginView, table_map, kitchen_board, payment_requests
from staff_api.views import StaffLoginView, table_map, table_detail, kitchen_board, payment_requests


urlpatterns = [
    path("", home),
    path("login/", auth_view),
    path("staff/login/", StaffLoginView.as_view(), name="staff-login"),
    path("tables/", table_map, name="staff-table-map"),
    path("tables/<int:table_id>/", table_detail, name="staff-table-detail"),
    path("kitchen/", kitchen_board, name="staff-kitchen"),
    path("payment-requests/", payment_requests, name="staff-payment-requests"),
    path("shop/", menu_view),
    path("menu/", menu_view),
    path("menu/<slug:category_slug>/", category_view),
    path("product/<int:product_id>/", product_detail_view),
    path("product/<int:product_id>/configure/", configure_order_view),
    path("products/", menu_view),
    path("cart/", cart_view),
    path("orders/", orders_view),
    path("admin/", admin.site.urls),
    path("order-confirmed/", order_confirmed_view),
    path("api/", api.urls),
    path("api/staff/", staff_api.urls),
]




if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
