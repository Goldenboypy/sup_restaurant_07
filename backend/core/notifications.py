"""Thin wrapper around Django Channels' `group_send`.

Both `guest_api/routers.py` and `staff_api/routers.py` push WebSocket
events through these three functions, so channel/group naming lives in
exactly one place instead of being duplicated (and drifting) across apps.

Group naming convention:
    kitchen              -- staff_api.consumers.KitchenConsumer
    waiter_<waiter_id>   -- staff_api.consumers.WaiterConsumer
    table_<session_token>-- guest_api.consumers.GuestTableConsumer
"""
from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _group_send(group: str, channel_event_type: str, event: str, payload: dict) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        group,
        {"type": channel_event_type, "event": event, "payload": payload},
    )


def notify_kitchen(payload: dict) -> None:
    """-> KitchenConsumer.ticket_new"""
    _group_send("kitchen", "ticket_new", "ticket.new", payload)


def notify_waiter(waiter_id: int, event: str, payload: dict) -> None:
    """event is one of: order.submitted | ticket.ready | payment.requested"""
    channel_event_type = event.replace(".", "_")  # Channels handler names can't contain dots
    _group_send(f"waiter_{waiter_id}", channel_event_type, event, payload)


def notify_guest_session(session_token: str, event: str, payload: dict) -> None:
    """event is one of: order.status_changed | bill.ready"""
    channel_event_type = event.replace(".", "_")
    _group_send(f"table_{session_token}", channel_event_type, event, payload)