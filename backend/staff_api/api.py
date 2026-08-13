"""Composition root for the Staff REST API.

A dedicated `NinjaAPI()` instance -- NOT shared with `guest_api` -- so
auth, docs and versioning stay fully isolated. This is the v4 fix: the
old shared root-level `api.py` mounted both namespaces on one instance,
which coupled two endpoints that must never share an auth mechanism.
"""
from __future__ import annotations

from ninja import NinjaAPI, Router, Schema
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token

from .auth import staff_bearer_auth
from .routers import router as staff_router
from core.models import Waiter


class StaffLoginIn(Schema):
    username: str
    password: str


class StaffWaiterOut(Schema):
    id: int
    name: str
    role: str


class StaffLoginOut(Schema):
    token: str
    waiter: StaffWaiterOut


auth_router = Router(tags=["staff auth"])


@auth_router.post("/login", auth=None, response=StaffLoginOut)
def staff_login(request, data: StaffLoginIn):
    user = authenticate(username=data.username, password=data.password)
    if user is None or not user.is_active:
        from ninja.errors import HttpError
        raise HttpError(401, "Invalid username or password")

    waiter = getattr(user, "waiter_profile", None)
    if waiter is None:
        from ninja.errors import HttpError
        raise HttpError(403, "User is not configured as staff")

    token, _ = Token.objects.get_or_create(user=user)
    return {
        "token": token.key,
        "waiter": {"id": waiter.id, "name": waiter.display_name, "role": "waiter"},
    }


@auth_router.get("/me", response=StaffWaiterOut)
def staff_me(request):
    waiter: Waiter = request.auth
    return {"id": waiter.id, "name": waiter.display_name, "role": "waiter"}

api = NinjaAPI(
    title="Restaurant Staff API",
    version="1.0.0",
    urls_namespace="staff_api",
    auth=staff_bearer_auth,
)

api.add_router("/auth/", auth_router)
api.add_router("/", staff_router)