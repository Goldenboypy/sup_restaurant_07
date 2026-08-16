from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote

from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import get_object_or_404, redirect, render

from core.models import KitchenTicket, PaymentRequest, RestaurantOrder, Table, TableSession
from core.notifications import notify_kitchen


class StaffLoginView(LoginView):
    template_name = "staff/login.html"
    redirect_authenticated_user = True

    def get_success_url(self):
        return "/tables/"


@login_required
def table_map(request):
    tables = Table.objects.select_related("assigned_waiter").order_by("number")
    return render(request, "staff/table_map.html", {"tables": tables})


@login_required
def table_detail(request, table_id: int):
    table = get_object_or_404(Table, id=table_id)
    waiter = getattr(request.user, "waiter_profile", None)

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "assign_self" and waiter is not None:
            table.assigned_waiter = waiter
            table.save(update_fields=["assigned_waiter"])

        elif action == "set_status":
            status = request.POST.get("status")
            if status in Table.Status.values:
                table.status = status
                table.save(update_fields=["status"])

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

        return redirect("staff-table-detail", table_id=table.id)

    guest_url = request.build_absolute_uri(f"/?qr={table.qr_token}")
    qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={quote(guest_url)}"

    pending_orders = (
        RestaurantOrder.objects.filter(
            session__table=table,
            session__status=TableSession.Status.ACTIVE,
            confirmed_by_waiter=False,
        )
        .select_related("session")
        .prefetch_related("items__menu_item")
    )

    return render(request, "staff/table_detail.html", {
        "table": table,
        "qr_image_url": qr_image_url,
        "guest_url": guest_url,
        "pending_orders": pending_orders,
    })


@login_required
def kitchen_board(request):
    tickets = (
        KitchenTicket.objects.exclude(status=KitchenTicket.Status.READY)
        .select_related("order__session__table")
        .prefetch_related("order__items__menu_item")
    )
    return render(request, "staff/kitchen.html", {"tickets": tickets})


@login_required
def payment_requests(request):
    requests_qs = PaymentRequest.objects.filter(completed_at__isnull=True).select_related("session__table")
    return render(request, "staff/payment_requests.html", {"payment_requests": requests_qs})