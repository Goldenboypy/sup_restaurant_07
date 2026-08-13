"""Pydantic (Ninja) schemas for the Staff API.

Kept deliberately separate from `guest_api/schemas.py` -- staff responses
are allowed to include prices, waiter identities and internal IDs that a
guest must never see (see the "prices hidden until Pay" rule in the
Restaurant API ASCII docs).
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from ninja import Schema
from pydantic import field_validator

from core.models import KitchenTicket, Table


class WaiterOut(Schema):
    id: int
    display_name: str


class TableOut(Schema):
    id: int
    number: int
    seats: int
    status: str
    assigned_waiter: WaiterOut | None = None


class TableAssignOut(TableOut):
    """Identical shape to TableOut; kept as its own type for API-doc clarity."""


class TableStatusIn(Schema):
    status: str  # "free" | "occupied"

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str) -> str:
        if value not in Table.Status.values:
            raise ValueError(f"invalid table status: {value!r}")
        return value


class TableQrOut(Schema):
    qr_token: UUID
    guest_menu_url: str


class MenuItemMiniOut(Schema):
    id: int
    name: str
    price: Decimal


class OrderItemOut(Schema):
    id: int
    menu_item: MenuItemMiniOut
    quantity: int
    excluded_ingredients: list[str] = []


class OrderOut(Schema):
    id: int
    table_number: int
    status: str
    submitted_at: datetime
    confirmed_by_waiter: bool
    items: list[OrderItemOut]

    @staticmethod
    def resolve_table_number(obj) -> int:
        return obj.session.table.number


class TicketStatusIn(Schema):
    status: str  # "in_progress" | "ready"

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str) -> str:
        allowed = {KitchenTicket.Status.IN_PROGRESS, KitchenTicket.Status.READY}
        if value not in allowed:
            raise ValueError(f"invalid ticket status: {value!r}")
        return value


class KitchenTicketOut(Schema):
    id: int
    order_id: int
    table_number: int
    status: str
    created_at: datetime

    @staticmethod
    def resolve_table_number(obj) -> int:
        return obj.order.session.table.number


class PaymentRequestOut(Schema):
    id: int
    table_number: int
    method: str
    requested_at: datetime
    completed_at: datetime | None = None

    @staticmethod
    def resolve_table_number(obj) -> int:
        return obj.session.table.number