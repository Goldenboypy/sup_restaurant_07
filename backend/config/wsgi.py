"""
config/wsgi.py
--------------
WSGI entry point for Django.

Development:
    python manage.py runserver   (uses this automatically)

Production (gunicorn):
    gunicorn config.wsgi:application
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()