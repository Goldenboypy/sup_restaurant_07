"""WebSocket routes for the Staff App -- combined into the ASGI app
alongside `guest_api.routing.websocket_urlpatterns` (see config/asgi.py).
"""
from __future__ import annotations

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/staff/waiter/(?P<waiter_id>\d+)/$", consumers.WaiterConsumer.as_asgi()),
    re_path(r"^ws/staff/kitchen/$", consumers.KitchenConsumer.as_asgi()),
]