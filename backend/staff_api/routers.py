"""REST endpoints for the Staff App: table map, order confirmation,
kitchen tickets and payment requests.

Mounted with `staff_bearer_auth` as the NinjaAPI-wide default auth (see
`api.py`), so every view here can assume `request.auth` is a resolved
`Waiter` -- no per-endpoint auth wiring needed.
"""
from __future__ import annotations

from datetime import datetime, timezone

from django.shortcuts import get_object_or_404
from ninja import Router

from core.models import KitchenTicket, Order, PaymentRequest, Table, TableSession, Waiter
from core.notifications import notify_guest_session, notify_kitchen, notify_waiter

from .schemas import (
    KitchenTicketOut,
    OrderOut,
    PaymentRequestOut,
    TableAssignOut,
    TableOut,
    TableQrOut,
    TableStatusIn,
    TicketStatusIn,
)

router = Router(tags=["staff"])


# --------------------------------------------------------------------------
# Tables
# --------------------------------------------------------------------------
@router.get("/tables", response=list[TableOut])
def list_tables(request):
    """Table map: every table with its status and current waiter."""
    return Table.objects.select_related("assigned_waiter").order_by("number")


@router.patch("/tables/{table_id}/status", response=TableOut)
def set_table_status(request, table_id: int, payload: TableStatusIn):
    """Waiter marks a table Free or Occupied when seating/releasing a guest."""
    table = get_object_or_404(Table, id=table_id)
    table.status = payload.status
    table.save(update_fields=["status"])
    return table


@router.patch("/tables/{table_id}/assign", response=TableAssignOut)
def assign_table(request, table_id: int):
    """The calling waiter claims this table as theirs."""
    table = get_object_or_404(Table, id=table_id)
    waiter: Waiter = request.auth
    table.assigned_waiter = waiter
    table.save(update_fields=["assigned_waiter"])
    return table


@router.get("/tables/{table_id}/qr", response=TableQrOut)
def table_qr(request, table_id: int):
    """Returns the token used to build/print the table's QR code.

    Rendering the actual QR image is left to the frontend (or a small
    dedicated `/qr/<token>.png` endpoint) -- this just hands back the
    stable token + the URL it should encode.
    """
    table = get_object_or_404(Table, id=table_id)
    return {
        "qr_token": table.qr_token,
        "guest_menu_url": f"https://guest.example.com/t/{table.qr_token}",
    }


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------
@router.get("/orders/pending", response=list[OrderOut])
def pending_orders(request):
    """Orders a guest has submitted but no waiter has confirmed yet."""
    return (
        Order.objects.filter(confirmed_by_waiter=False)
        .select_related("session__table")
        .prefetch_related("items__menu_item")
    )


@router.patch("/orders/{order_id}/confirm", response=OrderOut)
def confirm_order(request, order_id: int):
    """Waiter confirms an order -> creates the KitchenTicket and notifies
    the kitchen display + the guest (status update)."""
    order = get_object_or_404(Order, id=order_id)
    waiter: Waiter = request.auth

    order.confirmed_by_waiter = True
    order.confirmed_at = datetime.now(timezone.utc)
    order.confirmed_by = waiter
    order.status = Order.Status.WAITER_CONFIRMED
    order.save(update_fields=["confirmed_by_waiter", "confirmed_at", "confirmed_by", "status"])

    ticket = KitchenTicket.objects.create(order=order)

    notify_kitchen({
        "ticket_id": ticket.id,
        "order_id": order.id,
        "table_number": order.session.table.number,
    })
    notify_guest_session(str(order.session.session_token), "order.status_changed", {
        "order_id": order.id,
        "status": order.status,
    })
    return order


@router.patch("/orders/{order_id}/served", response=OrderOut)
def mark_order_served(request, order_id: int):
    """Waiter marks the order as delivered to the table.

    This is what unlocks the guest's [ Pay ] button for this order.
    """
    order = get_object_or_404(Order, id=order_id)
    waiter: Waiter = request.auth

    order.status = Order.Status.SERVED
    order.served_at = datetime.now(timezone.utc)
    order.served_by = waiter
    order.save(update_fields=["status", "served_at", "served_by"])

    notify_guest_session(str(order.session.session_token), "order.status_changed", {
        "order_id": order.id,
        "status": order.status,
    })
    return order


# --------------------------------------------------------------------------
# Kitchen
# --------------------------------------------------------------------------
@router.get("/kitchen/tickets", response=list[KitchenTicketOut])
def kitchen_tickets(request):
    """Active tickets for the kitchen display (New / In progress)."""
    return (
        KitchenTicket.objects.exclude(status=KitchenTicket.Status.READY)
        .select_related("order__session__table")
        .prefetch_related("order__items__menu_item")
    )


@router.patch("/kitchen/tickets/{ticket_id}", response=KitchenTicketOut)
def update_ticket_status(request, ticket_id: int, payload: TicketStatusIn):
    """Kitchen updates a ticket. Marking it Ready notifies the ORIGINAL
    assigned waiter (not a broadcast) and syncs the parent Order's status."""
    ticket = get_object_or_404(KitchenTicket, id=ticket_id)
    ticket.status = payload.status

    if payload.status == KitchenTicket.Status.READY:
        ticket.completed_at = datetime.now(timezone.utc)
        ticket.order.status = Order.Status.READY
        ticket.order.save(update_fields=["status"])

        waiter = ticket.order.confirmed_by
        if waiter is not None:
            notify_waiter(waiter.id, "ticket.ready", {
                "ticket_id": ticket.id,
                "order_id": ticket.order_id,
                "table_number": ticket.order.session.table.number,
            })
    else:
        ticket.order.status = Order.Status.KITCHEN_IN_PROGRESS
        ticket.order.save(update_fields=["status"])

    ticket.save(update_fields=["status", "completed_at"])
    return ticket


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------
@router.get("/payment-requests", response=list[PaymentRequestOut])
def list_payment_requests(request):
    """Tables where the guest has pressed Pay and is waiting to be cleared."""
    return PaymentRequest.objects.filter(completed_at__isnull=True).select_related("session__table")


@router.patch("/payment-requests/{payment_request_id}", response=PaymentRequestOut)
def complete_payment(request, payment_request_id: int):
    """Waiter finishes collecting payment and clears the table -> table
    becomes Free again and the session is closed."""
    payment_request = get_object_or_404(PaymentRequest, id=payment_request_id)
    now = datetime.now(timezone.utc)

    payment_request.completed_at = now
    payment_request.save(update_fields=["completed_at"])

    table = payment_request.session.table
    table.status = Table.Status.FREE
    table.assigned_waiter = None
    table.save(update_fields=["status", "assigned_waiter"])

    session = payment_request.session
    session.status = TableSession.Status.CLOSED
    session.ended_at = now
    session.save(update_fields=["status", "ended_at"])

    return payment_request