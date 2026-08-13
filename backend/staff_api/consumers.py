"""Staff-side WebSocket consumers.

Two consumers, matching the two staff roles from the Restaurant API
ASCII docs:

  * WaiterConsumer  -- ws/staff/waiter/<waiter_id>/
        Events: order.submitted, ticket.ready, payment.requested
  * KitchenConsumer -- ws/staff/kitchen/
        Events: ticket.new

Both authenticate the same way the REST layer does: a Bearer token,
here passed as a `?token=` query param on the WS handshake and resolved
via `resolve_waiter_from_token` (see auth.py) -- so there is exactly one
place that decides "is this token a real waiter".
"""
from __future__ import annotations

from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .auth import resolve_waiter_from_token


class StaffConsumerBase(AsyncJsonWebsocketConsumer):
    group_name: str = ""

    async def connect(self) -> None:
        token = self._token_from_query_string()
        waiter = (
            await sync_to_async(resolve_waiter_from_token, thread_sensitive=True)(token)
            if token
            else None
        )
        if waiter is None:
            await self.close(code=4401)  # unauthorized
            return

        self.waiter = waiter
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    def _token_from_query_string(self) -> str | None:
        query = parse_qs(self.scope["query_string"].decode())
        values = query.get("token")
        return values[0] if values else None

    async def _forward(self, message: dict) -> None:
        """Relay a channel-layer message straight to the client as JSON."""
        await self.send_json({"event": message["event"], "payload": message["payload"]})


class WaiterConsumer(StaffConsumerBase):
    """One socket per waiter -- receives events only about THEIR tables."""

    async def connect(self) -> None:
        self.waiter_id = self.scope["url_route"]["kwargs"]["waiter_id"]
        self.group_name = f"waiter_{self.waiter_id}"
        await super().connect()
        if hasattr(self, "waiter") and str(self.waiter.id) != str(self.waiter_id):
            # token is valid but belongs to a different waiter than the URL
            await self.close(code=4403)

    async def order_submitted(self, message: dict) -> None:
        await self._forward(message)

    async def ticket_ready(self, message: dict) -> None:
        await self._forward(message)

    async def payment_requested(self, message: dict) -> None:
        await self._forward(message)


class KitchenConsumer(StaffConsumerBase):
    """One shared group for the kitchen display screen(s) -- no per-waiter split."""

    group_name = "kitchen"

    async def ticket_new(self, message: dict) -> None:
        await self._forward(message)