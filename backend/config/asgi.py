"""
config/asgi.py
--------------
ASGI entry point — handles both HTTP and WebSocket connections.

Connection map:
    ← config/settings.py          : DJANGO_SETTINGS_MODULE, CHANNEL_LAYERS
    ← guest_api/routing.py        : websocket_urlpatterns
    → guest_api/consumers.py      : routed via ProtocolTypeRouter
    → staff_api/consumers.py      : routed via ProtocolTypeRouter

Protocol routing:
    "http"      → Django ASGI app  → config/urls.py → guest_api/api.py
    "websocket" → AllowedHostsOriginValidator
                    → URLRouter(websocket_urlpatterns)
                        → OrderConsumer, NotificationConsumer,
                          StockConsumer, GuestTableConsumer
                        → WaiterConsumer, KitchenConsumer

Production:
    daphne -b 0.0.0.0 -p 8000 config.asgi:application

Development:
    python manage.py runserver   (daphne handles this automatically once
                                   "daphne" is first in INSTALLED_APPS)
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Must be called before importing Channels or consumers
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter    # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from guest_api.routing import websocket_urlpatterns          # ← routing.py

application = ProtocolTypeRouter({
    # HTTP → standard Django (Ninja API handles it via config/urls.py)
    "http": django_asgi_app,

    # WebSocket → Channels → consumers.py
    "websocket": AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})