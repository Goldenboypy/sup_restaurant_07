from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from urllib.parse import parse_qs

from .auth import resolve_waiter_from_token


def _waiter_profile(user):
    return getattr(user, "waiter_profile", None)


class StaffConsumerBase(AsyncJsonWebsocketConsumer):
    group_name: str = ""

    async def connect(self) -> None:
        self.waiter = await self._resolve_waiter()
        if self.waiter is None:
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def _resolve_waiter(self):
        # 1) Session-Login (der aktuell laufende Django-Template-Staff-Bereich)
        user = self.scope.get("user")
        if user is not None and user.is_authenticated:
            waiter = await sync_to_async(_waiter_profile, thread_sensitive=True)(user)
            if waiter is not None:
                return waiter
        # 2) Bearer-Token via ?token= (React-App, falls später genutzt)
        token = self._token_from_query_string()
        if token:
            return await sync_to_async(resolve_waiter_from_token, thread_sensitive=True)(token)
        return None

    async def disconnect(self, close_code: int) -> None:
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    def _token_from_query_string(self) -> str | None:
        query = parse_qs(self.scope["query_string"].decode())
        values = query.get("token")
        return values[0] if values else None

    async def _forward(self, message: dict) -> None:
        await self.send_json({"event": message["event"], "payload": message["payload"]})


class WaiterConsumer(StaffConsumerBase):
    async def connect(self) -> None:
        self.waiter_id = self.scope["url_route"]["kwargs"]["waiter_id"]
        self.group_name = f"waiter_{self.waiter_id}"
        await super().connect()
        if hasattr(self, "waiter") and self.waiter is not None and str(self.waiter.id) != str(self.waiter_id):
            # eingeloggt, aber falscher Kellner in der URL -> fremde Bestellungen nicht mithören
            await self.close(code=4403)

    async def order_submitted(self, message: dict) -> None:
        await self._forward(message)

    async def ticket_ready(self, message: dict) -> None:
        await self._forward(message)

    async def payment_requested(self, message: dict) -> None:
        await self._forward(message)


class KitchenConsumer(StaffConsumerBase):
    group_name = "kitchen"

    async def ticket_new(self, message: dict) -> None:
        await self._forward(message)