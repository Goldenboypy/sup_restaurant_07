"""Server-rendered fallback pages for the Staff App (`frontend/templates/staff/*`).

These call the exact same core models as `staff_api/routers.py` so the
React Staff App and this no-JS fallback never drift apart. Deliberately
NOT wired into the WebSocket layer -- the fallback expects a manual
page refresh instead of live notifications.
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import get_object_or_404, render

from core.models import KitchenTicket, PaymentRequest, Table


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
    return render(request, "staff/table_detail.html", {"table": table})


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