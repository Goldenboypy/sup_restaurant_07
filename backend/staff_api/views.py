from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote
from uuid import UUID

from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone as dj_timezone

from core.models import KitchenTicket, PaymentRequest, RestaurantOrder, Table, TableSession
from core.notifications import notify_kitchen, notify_guest_session, notify_waiter



def resolve_active_session_for_qr(qr_param):
    """Look up an ALREADY-ACTIVE session for the table behind this QR token.
    Never creates a session — only staff (table_detail's 'open_ordering'
    action) is allowed to do that. This is what stops a photographed QR
    code from being usable outside of a waiter-opened window.
    """
    if not qr_param:
        return None, None
    try:
        qr_uuid = UUID(qr_param)
    except (ValueError, TypeError):
        return None, None
    table = Table.objects.filter(qr_token=qr_uuid).first()
    if not table:
        return None, None
    session = (
        TableSession.objects
        .filter(table=table, status=TableSession.Status.ACTIVE)
        .order_by("-started_at")
        .first()
    )
    return table, session


class StaffLoginView(LoginView):
    template_name = "staff/login.html"
    redirect_authenticated_user = True

    def get_success_url(self):
        return "/tables/"


@login_required
def table_map(request):
    tables = Table.objects.select_related("assigned_waiter").order_by("number")
    ready_table_numbers = set(
        RestaurantOrder.objects.filter(status=RestaurantOrder.Status.READY)
        .values_list("session__table__number", flat=True)
    )
    return render(request, "staff/table_map.html", {
        "tables": tables,
        "ready_table_numbers": ready_table_numbers,
    })

@login_required
def table_detail(request, table_id: int):
    table = get_object_or_404(Table, id=table_id)
    waiter = getattr(request.user, "waiter_profile", None)

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "assign_self" and waiter is not None:
            is_admin = request.user.is_superuser
            if table.assigned_waiter is None or is_admin:
                table.assigned_waiter = waiter
                table.save(update_fields=["assigned_waiter"])
            # else: table already belongs to someone else -> silently ignore,
            # no other waiter is allowed to grab it away from them.

        elif action == "unassign_self":
            is_admin = request.user.is_superuser
            if table.assigned_waiter is not None and (table.assigned_waiter == waiter or is_admin):
                table.assigned_waiter = None
                table.save(update_fields=["assigned_waiter"])
            # else: not your table and you're not an admin -> silently ignore.

        elif action == "set_status":
            status = request.POST.get("status")
            if status in Table.Status.values:
                table.status = status
                table.save(update_fields=["status"])

        elif action == "open_ordering":
            existing = TableSession.objects.filter(table=table, status=TableSession.Status.ACTIVE).first()
            if existing is None:
                TableSession.objects.create(table=table)
            if table.status == Table.Status.FREE:
                table.status = Table.Status.OCCUPIED
                table.save(update_fields=["status"])

        elif action == "close_ordering":
            TableSession.objects.filter(
                table=table, status=TableSession.Status.ACTIVE
            ).update(status=TableSession.Status.CLOSED, ended_at=dj_timezone.now())

        elif action == "confirm_order":
            order_id = request.POST.get("order_id")
            order = get_object_or_404(RestaurantOrder, id=order_id)
            order.confirmed_by_waiter = True
            order.confirmed_at = datetime.now(timezone.utc)
            order.confirmed_by = waiter
            order.status = RestaurantOrder.Status.WAITER_CONFIRMED
            order.save(update_fields=["confirmed_by_waiter", "confirmed_at", "confirmed_by", "status"])

            ticket = KitchenTicket.objects.create(order=order)
            notify_kitchen({
                "ticket_id": ticket.id,
                "order_id": order.id,
                "table_number": table.number,
            })

        elif action == "reject_order":
            order_id = request.POST.get("order_id")
            order = get_object_or_404(RestaurantOrder, id=order_id)
            order.status = RestaurantOrder.Status.REJECTED
            order.save(update_fields=["status"])

            notify_guest_session(str(order.session.session_token), "order.status_changed", {
                "order_id": order.id,
                "status": order.status,
            })

        elif action == "mark_served":
            order_id = request.POST.get("order_id")
            order = get_object_or_404(RestaurantOrder, id=order_id)
            order.status = RestaurantOrder.Status.SERVED
            order.served_at = dj_timezone.now()
            order.served_by = waiter
            order.save(update_fields=["status", "served_at", "served_by"])

            notify_guest_session(str(order.session.session_token), "order.status_changed", {
                "order_id": order.id,
                "status": order.status,
            })

        return redirect("staff-table-detail", table_id=table.id)

    guest_url = request.build_absolute_uri(f"/?qr={table.qr_token}")
    qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={quote(guest_url)}"

    active_session = TableSession.objects.filter(
        table=table, status=TableSession.Status.ACTIVE
    ).first()

    pending_orders = (
        RestaurantOrder.objects.filter(
            session__table=table,
            session__status=TableSession.Status.ACTIVE,
            confirmed_by_waiter=False,
        )
        .exclude(status=RestaurantOrder.Status.REJECTED)
        .select_related("session")
        .prefetch_related("items__menu_item")
    )

    ready_orders = (
        RestaurantOrder.objects.filter(
            session__table=table,
            session__status=TableSession.Status.ACTIVE,
            status=RestaurantOrder.Status.READY,
        )
        .select_related("session")
        .prefetch_related("items__menu_item")
    )

    return render(request, "staff/table_detail.html", {
        "table": table,
        "qr_image_url": qr_image_url,
        "guest_url": guest_url,
        "active_session": active_session,
        "pending_orders": pending_orders,
        "ready_orders": ready_orders,
    })


@login_required
def kitchen_board(request):
    cook = getattr(request.user, "waiter_profile", None)
    is_admin = request.user.is_superuser

    if request.method == "POST":
        action = request.POST.get("action")
        ticket_id = request.POST.get("ticket_id")
        ticket = get_object_or_404(KitchenTicket, id=ticket_id)

        if action == "assign_self" and cook is not None:
            if ticket.assigned_cook is None or is_admin:
                ticket.assigned_cook = cook
                ticket.save(update_fields=["assigned_cook"])

        elif action == "unassign_self":
            if ticket.assigned_cook is not None and (ticket.assigned_cook == cook or is_admin):
                ticket.assigned_cook = None
                ticket.save(update_fields=["assigned_cook"])

        elif action == "set_ticket_status":
            new_status = request.POST.get("status")
            if new_status in KitchenTicket.Status.values:
                ticket.status = new_status

                if new_status == KitchenTicket.Status.READY:
                    ticket.completed_at = dj_timezone.now()
                    ticket.order.status = RestaurantOrder.Status.READY
                    ticket.order.save(update_fields=["status"])

                    waiter = ticket.order.confirmed_by
                    if waiter is not None:
                        notify_waiter(waiter.id, "ticket.ready", {
                            "ticket_id": ticket.id,
                            "order_id": ticket.order_id,
                            "table_number": ticket.order.session.table.number,
                        })

                    notify_guest_session(str(ticket.order.session.session_token), "order.status_changed", {
                        "order_id": ticket.order_id,
                        "status": ticket.order.status,
                    })
                else:
                    ticket.order.status = RestaurantOrder.Status.KITCHEN_IN_PROGRESS
                    ticket.order.save(update_fields=["status"])

                ticket.save(update_fields=["status", "completed_at"])

        return redirect("staff-kitchen")

    tickets = (
        KitchenTicket.objects
        .select_related("order__session__table", "order__confirmed_by", "assigned_cook")
        .prefetch_related("order__items__menu_item")
        .order_by("created_at")
    )
    return render(request, "staff/kitchen.html", {
        "tickets_new": tickets.filter(status=KitchenTicket.Status.NEW),
        "tickets_in_progress": tickets.filter(status=KitchenTicket.Status.IN_PROGRESS),
        "tickets_ready": tickets.filter(status=KitchenTicket.Status.READY),
        "cook": cook,
    })


@login_required
def payment_requests(request):
    requests_qs = PaymentRequest.objects.filter(completed_at__isnull=True).select_related("session__table")
    return render(request, "staff/payment_requests.html", {"payment_requests": requests_qs})