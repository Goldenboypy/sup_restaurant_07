"""
guest_api/routing.py
----------------------
WebSocket URL patterns for Django Channels.

Connection map:
    ← consumers.py  : OrderConsumer, NotificationConsumer, StockConsumer
    → config/asgi.py : imported into ProtocolTypeRouter as URLRouter

WebSocket URLs:
    ws://localhost:8000/ws/orders/              OrderConsumer
    ws://localhost:8000/ws/notifications/       NotificationConsumer
    ws://localhost:8000/ws/stock/<product_id>/  StockConsumer
"""

from django.urls import path

from .consumers import (        # ← consumers.py
    OrderConsumer,
    NotificationConsumer,
    StockConsumer,
)

websocket_urlpatterns = [
    path("ws/orders/",               OrderConsumer.as_asgi()),
    path("ws/notifications/",        NotificationConsumer.as_asgi()),
    path("ws/stock/<int:product_id>/", StockConsumer.as_asgi()),
]