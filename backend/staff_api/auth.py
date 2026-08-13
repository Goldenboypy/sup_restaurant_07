"""Bearer-token authentication for the Staff App.

Every staff endpoint requires a logged-in `Waiter`. `resolve_waiter_from_token`
is the single source of truth for turning a raw token string into a Waiter --
it's used by both the REST layer (`StaffBearerAuth`, wired into `api.py`)
and the WebSocket layer (`consumers.py`), so there is exactly one place
that can get this wrong.
"""
from __future__ import annotations

from ninja.security import HttpBearer

from core.models import Waiter


def resolve_waiter_from_token(token: str) -> Waiter | None:
    """Look up the Waiter behind a Bearer token.

    Reuses DRF's `rest_framework.authtoken.models.Token` table so staff
    login (`staff_api/views.py` -> `StaffLoginView`) and the API/WS auth
    share one source of truth. Swap the body of this function for
    `simplejwt`/`ninja-jwt` later if the project moves to short-lived
    JWTs -- callers only depend on this function's signature.
    """
    from rest_framework.authtoken.models import Token

    try:
        token_obj = Token.objects.select_related("user__waiter_profile").get(key=token)
    except Token.DoesNotExist:
        return None
    return getattr(token_obj.user, "waiter_profile", None)


class StaffBearerAuth(HttpBearer):
    """Ninja auth class: resolves `Authorization: Bearer <token>` to a Waiter."""

    def authenticate(self, request, token: str) -> Waiter | None:
        waiter = resolve_waiter_from_token(token)
        if waiter is not None:
            request.waiter = waiter  # convenience access alongside request.auth
        return waiter


staff_bearer_auth = StaffBearerAuth()