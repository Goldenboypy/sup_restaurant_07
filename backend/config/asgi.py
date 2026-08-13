bash

cat > /home/claude/project/config/asgi.py << 'EOF'
"""
config/asgi.py
--------------
ASGI entry point — handles both HTTP and WebSocket connections.

Connection map:
    ← config/settings.py          : DJANGO_SETTINGS_MODULE, CHANNEL_LAYERS
    ← supermarket/routing.py      : websocket_urlpatterns
    → supermarket/consumers.py    : routed via ProtocolTypeRouter

Protocol routing:
    "http"      → Django ASGI app  → config/urls.py → supermarket/api.py
    "websocket" → AuthMiddlewareStack
                    → URLRouter(websocket_urlpatterns)
                        → OrderConsumer
                        → NotificationConsumer
                        → StockConsumer

Production:
    uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 4

Development:
    python manage.py runserver
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
EOF
echo "asgi.py updated"






