"""
guest_api/auth.py
-------------------
Legacy Bearer-token authentication + /api/auth/* endpoints.

This module belongs to the older supermarket/user API. QR-based guest
ordering uses the separate `/api/guest/` namespace and `X-Table-Session`.

Connection map:
    ← settings.py  : CACHES block — tokens are stored in Django's cache
    ← models.py    : User (django built-in), Cart, LoyaltyCard
                     (Cart + LoyaltyCard created automatically on register)
    ← schemas.py   : RegisterSchema, LoginSchema, TokenSchema, UserOut, MessageOut
    → api.py       : `router`   exported and mounted at /api/auth/
    → routers.py   : `auth` (AuthBearer instance) imported and used as
                     the `auth=` argument on protected endpoints
"""

import secrets

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache        # ← settings.py :: CACHES
from ninja import Router
from ninja.security import HttpBearer

from core.models import Cart, LoyaltyCard      # ← core/models.py
from .schemas import (                     # ← schemas.py
    RegisterSchema,
    LoginSchema,
    TokenSchema,
    UserOut,
    MessageOut,
)

# ---------------------------------------------------------------------------
# Token helpers
# Key format : "supermarket:token:<random>"
# Value      : user.id  (int)
# TTL        : 7 days
# ---------------------------------------------------------------------------
_PREFIX = "guest_api:token:"
_TTL    = 60 * 60 * 24 * 7   # 7 days in seconds


def _make_token(user_id: int) -> str:
    """Generate a secure random token and store it in the cache."""
    token = secrets.token_urlsafe(40)
    cache.set(f"{_PREFIX}{token}", user_id, _TTL)
    return token


def _user_from_token(token: str) -> User | None:
    """Look up the user for a given token. Returns None if invalid/expired."""
    user_id = cache.get(f"{_PREFIX}{token}")
    if not user_id:
        return None
    try:
        return User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return None


def _delete_token(token: str) -> None:
    cache.delete(f"{_PREFIX}{token}")


# ---------------------------------------------------------------------------
# AuthBearer — the security class imported by routers.py
# ---------------------------------------------------------------------------
class AuthBearer(HttpBearer):
    """
    Validates the  Authorization: Bearer <token>  header.
    On success:  sets request.auth = User instance
    On failure:  returns 401 automatically (Ninja behaviour)
    """
    def authenticate(self, request, token: str):
        user = _user_from_token(token)
        if user:
            request.auth = user   # available as request.auth in every handler
            return user
        return None


# Singleton — imported as `auth` in routers.py and api.py
auth = AuthBearer()


# ---------------------------------------------------------------------------
# /api/auth/ router
# ---------------------------------------------------------------------------
router = Router(tags=["Auth"])


@router.post(
    "/register",
    response=TokenSchema,
    summary="Register a new user",
    description=(
        "Creates a new user account. "
        "Also auto-creates a **Cart** and a **LoyaltyCard** for the user. "
        "Returns a Bearer token ready to use immediately."
    ),
)
def register(request, data: RegisterSchema):
    # ── validation ──────────────────────────────────────────────────────────
    if len(data.username) < 3:
        from ninja.errors import HttpError
        raise HttpError(400, "username must be at least 3 characters")
    if len(data.password) < 6:
        from ninja.errors import HttpError
        raise HttpError(400, "password must be at least 6 characters")
    if User.objects.filter(username=data.username).exists():
        from ninja.errors import HttpError
        raise HttpError(400, "username already taken")

    # ── create user ──────────────────────────────────────────────────────────
    user = User.objects.create_user(
        username   = data.username,
        email      = data.email,
        password   = data.password,
        first_name = data.first_name,
        last_name  = data.last_name,
    )

    # ── create related objects automatically ─────────────────────────────────
    Cart.objects.create(user=user)

    card_number = f"KRZ{user.id:04d}{secrets.token_hex(5).upper()}"[:16]
    LoyaltyCard.objects.create(user=user, card_number=card_number)

    # ── issue token ──────────────────────────────────────────────────────────
    return TokenSchema(access=_make_token(user.id))


@router.post(
    "/login",
    response=TokenSchema,
    summary="Login",
    description="Authenticate with username + password. Returns a Bearer token.",
)
def login(request, data: LoginSchema):
    user = authenticate(username=data.username, password=data.password)
    if not user:
        from ninja.errors import HttpError
        raise HttpError(401, "Invalid username or password")
    return TokenSchema(access=_make_token(user.id))


@router.post(
    "/logout",
    auth=auth,
    response=MessageOut,
    summary="Logout",
    description="Invalidates the current Bearer token.",
)
def logout(request):
    # Extract raw token string from the Authorization header
    raw = request.headers.get("Authorization", "")
    if raw.lower().startswith("bearer "):
        _delete_token(raw.split(" ", 1)[1])
    return MessageOut(message="Logged out successfully")


@router.get(
    "/me",
    auth=auth,
    response=UserOut,
    summary="Current user profile",
)
def me(request):
    return request.auth