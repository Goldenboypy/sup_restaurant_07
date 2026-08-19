"""
guest_api/consumers.py
------------------------
Django Channels WebSocket consumers.

Connection map:
    ← models.py       : Order, Product  (DB queries for real-time data)
    ← auth.py         : _user_from_token()  (token auth over WebSocket)
    ← config/asgi.py  : ProtocolTypeRouter routes "websocket" here
    ← guest_api/routing.py : URL patterns map to each consumer class

Available WebSocket endpoints:
    ws://localhost:8000/ws/orders/          OrderConsumer
        - connects user to their personal order channel
        - receives live order status updates
        - client can send:  {"action": "ping"}
        - server pushes:    {"type": "order.update", "order_id": 5, "status": "shipped"}

    ws://localhost:8000/ws/notifications/   NotificationConsumer
        - general notifications channel (per user)
        - server pushes:    {"type": "notification", "message": "..."}

    ws://localhost:8000/ws/stock/<product_id>/  StockConsumer
        - real-time stock level for a specific product
        - server pushes:    {"type": "stock.update", "product_id": 1, "stock": 42}
        - useful for storefront "Only N left!" live badge

Channel groups used:
    "orders_<user_id>"      personal order updates
    "notifications_<user_id>"  personal notifications
    "stock_<product_id>"    product stock updates (broadcast to all watchers)
"""

import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .auth import _user_from_token       # ← auth.py : token validation
from core.models import Order, Product    # ← core/models.py


# ===========================================================================
# HELPERS
# ===========================================================================

@database_sync_to_async
def get_user_by_token(token: str):
    """Validate Bearer token and return User or None (runs in thread pool)."""
    return _user_from_token(token)


@database_sync_to_async
def get_order_status(order_id: int, user_id: int):
    """Fetch a single order's status (owned by user)."""
    try:
        order = Order.objects.get(id=order_id, user_id=user_id)
        return {"order_id": order.id, "status": order.status}
    except Order.DoesNotExist:
        return None


@database_sync_to_async
def get_stock(product_id: int):
    """Fetch current stock level for a product."""
    try:
        p = Product.objects.get(id=product_id)
        return {"product_id": p.id, "name": p.name, "stock": p.stock_quantity}
    except Product.DoesNotExist:
        return None


def _parse_token(scope) -> str | None:
    """
    Extract Bearer token from WebSocket query string.
    Client connects as:  ws://localhost:8000/ws/orders/?token=<token>
    """
    query_string = scope.get("query_string", b"").decode()
    for part in query_string.split("&"):
        if part.startswith("token="):
            return part.split("=", 1)[1]
    return None


# ===========================================================================
# ORDER CONSUMER
# ws://localhost:8000/ws/orders/?token=<bearer_token>
# ===========================================================================
class OrderConsumer(AsyncWebsocketConsumer):
    """
    Personal channel for a user's order status updates.

    Flow:
        1. Client connects with ?token=<token>
        2. Token validated → user joined to group "orders_<user_id>"
        3. When an order status changes (via routers.py or admin),
           call:  channel_layer.group_send("orders_<user_id>", {...})
        4. This consumer pushes the message to the WebSocket client

    Client receives:
        {"type": "order.update", "order_id": 5, "status": "shipped", "message": "..."}

    Client can send:
        {"action": "ping"}                    → server replies with pong
        {"action": "get_status", "order_id": 5}  → server replies with current status
    """

    async def connect(self):
        # ── authenticate ────────────────────────────────────────────────────
        token = _parse_token(self.scope)
        if not token:
            await self.close(code=4001)
            return

        self.user = await get_user_by_token(token)
        if not self.user:
            await self.close(code=4003)
            return

        # ── join personal group ──────────────────────────────────────────────
        self.group_name = f"orders_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()
        await self.send(json.dumps({
            "type":    "connected",
            "message": f"Connected to order updates. Hello, {self.user.username}!",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle messages sent by the client."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(json.dumps({"type": "error", "message": "Invalid JSON"}))
            return

        action = data.get("action")

        # ── ping / pong ──────────────────────────────────────────────────────
        if action == "ping":
            await self.send(json.dumps({"type": "pong"}))

        # ── get current order status ─────────────────────────────────────────
        elif action == "get_status":
            order_id = data.get("order_id")
            if not order_id:
                await self.send(json.dumps({"type": "error", "message": "order_id required"}))
                return
            result = await get_order_status(order_id, self.user.id)
            if result:
                await self.send(json.dumps({"type": "order.status", **result}))
            else:
                await self.send(json.dumps({"type": "error", "message": "Order not found"}))

        else:
            await self.send(json.dumps({
                "type":    "error",
                "message": f"Unknown action: '{action}'",
            }))

    # ── group message handlers (called by channel_layer.group_send) ──────────

    async def order_update(self, event):
        """
        Called when someone does:
            await channel_layer.group_send(
                "orders_<user_id>",
                {"type": "order.update", "order_id": 5, "status": "shipped"}
            )
        Forwards the event to the WebSocket client.
        """
        await self.send(json.dumps({
            "type":     "order.update",
            "order_id": event["order_id"],
            "status":   event["status"],
            "message":  event.get("message", f"Your order #{event['order_id']} is now {event['status']}"),
        }))


# ===========================================================================
# NOTIFICATION CONSUMER
# ws://localhost:8000/ws/notifications/?token=<bearer_token>
# ===========================================================================
class NotificationConsumer(AsyncWebsocketConsumer):
    """
    General-purpose notification channel per user.

    Can be used for:
        - Promotional messages  ("Flash sale starts in 10 minutes!")
        - Loyalty bonus alerts  ("You earned 500 bonus points!")
        - Low stock alerts      ("Your cart item is almost out of stock")

    Push a notification from anywhere in the codebase:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"notifications_{user.id}",
            {
                "type":    "push.notification",
                "message": "Your order has been confirmed!",
                "level":   "success",          # info | success | warning | error
            }
        )

    Client receives:
        {"type": "notification", "message": "...", "level": "success"}
    """

    async def connect(self):
        token = _parse_token(self.scope)
        if not token:
            await self.close(code=4001)
            return

        self.user = await get_user_by_token(token)
        if not self.user:
            await self.close(code=4003)
            return

        self.group_name = f"notifications_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()
        await self.send(json.dumps({
            "type":    "connected",
            "message": "Notification channel active.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Notifications are server → client only; client sends nothing meaningful
        await self.send(json.dumps({"type": "pong"}))

    # ── group message handler ────────────────────────────────────────────────
    async def push_notification(self, event):
        await self.send(json.dumps({
            "type":    "notification",
            "message": event.get("message", ""),
            "level":   event.get("level", "info"),   # info | success | warning | error
        }))


# ===========================================================================
# STOCK CONSUMER
# ws://localhost:8000/ws/stock/<product_id>/
# (no auth required — public stock info)
# ===========================================================================
class StockConsumer(AsyncWebsocketConsumer):
    """
    Real-time stock level watcher for a single product.
    No authentication required — stock levels are public.

    Use case:
        Product detail page shows a live "42 left in stock" badge.
        When another user places an order, stock drops and all
        watchers of that product receive the update instantly.

    Trigger a stock update from anywhere in the codebase:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"stock_{product_id}",
            {
                "type":       "stock.update",
                "product_id": product_id,
                "stock":      new_stock_level,
            }
        )

    Client receives:
        {"type": "stock.update", "product_id": 3, "stock": 41}
    """

    async def connect(self):
        self.product_id = self.scope["url_route"]["kwargs"]["product_id"]
        self.group_name = f"stock_{self.product_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # send current stock immediately on connect
        data = await get_stock(self.product_id)
        if data:
            await self.send(json.dumps({"type": "stock.current", **data}))
        else:
            await self.send(json.dumps({"type": "error", "message": "Product not found"}))
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Client can request a manual refresh
        data = await get_stock(self.product_id)
        if data:
            await self.send(json.dumps({"type": "stock.current", **data}))

    # ── group message handler ────────────────────────────────────────────────
    async def stock_update(self, event):
        await self.send(json.dumps({
            "type":       "stock.update",
            "product_id": event["product_id"],
            "stock":      event["stock"],
        }))

# ===========================================================================
# GUEST TABLE CONSUMER
# ws://localhost:8000/ws/guest/table/<session_token>/
# (no auth required — the session_token itself is the guest's identity)
# ===========================================================================
class GuestTableConsumer(AsyncWebsocketConsumer):
    """
    Per-table-session channel for a dine-in guest.

    Pushed to via core.notifications.notify_guest_session(), used by
    staff_api/routers.py when a waiter confirms an order or marks it served.

    Client receives:
        {"type": "order.status_changed", "order_id": 5, "status": "served"}
        {"type": "bill.ready", ...}
    """

    async def connect(self):
        self.session_token = self.scope["url_route"]["kwargs"]["session_token"]
        self.group_name = f"table_{self.session_token}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass  # server → client only

    # ── group message handlers ──────────────────────────────────────────────
    # notify_guest_session() sends {"type": channel_event_type, "event": ..., "payload": ...}
    # where channel_event_type is event.replace(".", "_") — so these method
    # names must match exactly (order_status_changed, bill_ready).

    async def order_status_changed(self, event):
        await self.send(json.dumps({"type": event["event"], **event["payload"]}))

    async def bill_ready(self, event):
        await self.send(json.dumps({"type": event["event"], **event["payload"]}))