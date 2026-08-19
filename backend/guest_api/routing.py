"""
guest_api/routing.py
----------------------
WebSocket URL patterns for Django Channels — combines guest-side and
staff-side consumers into a single router, since config/asgi.py only
imports websocket_urlpatterns from this one module.

Connection map:
    ← consumers.py            : OrderConsumer, NotificationConsumer,
                                 StockConsumer, GuestTableConsumer
    ← staff_api/consumers.py  : WaiterConsumer, KitchenConsumer
    → config/asgi.py          : imported into ProtocolTypeRouter as URLRouter

WebSocket URLs:
    ws://localhost:8000/ws/orders/                    OrderConsumer
    ws://localhost:8000/ws/notifications/             NotificationConsumer
    ws://localhost:8000/ws/stock/<product_id>/        StockConsumer
    ws://localhost:8000/ws/guest/table/<session_token>/  GuestTableConsumer
    ws://localhost:8000/ws/staff/waiter/<waiter_id>/  WaiterConsumer
    ws://localhost:8000/ws/staff/kitchen/             KitchenConsumer
"""

from django.urls import path

from .consumers import (        # ← consumers.py
    OrderConsumer,
    NotificationConsumer,
    StockConsumer,
    GuestTableConsumer,
)
from staff_api.consumers import (   # ← staff_api/consumers.py
    WaiterConsumer,
    KitchenConsumer,
)

websocket_urlpatterns = [
    path("ws/orders/",               OrderConsumer.as_asgi()),
    path("ws/notifications/",        NotificationConsumer.as_asgi()),
    path("ws/stock/<int:product_id>/", StockConsumer.as_asgi()),
    path("ws/guest/table/<str:session_token>/", GuestTableConsumer.as_asgi()),
    path("ws/staff/waiter/<int:waiter_id>/", WaiterConsumer.as_asgi()),
    path("ws/staff/kitchen/",        KitchenConsumer.as_asgi()),
]