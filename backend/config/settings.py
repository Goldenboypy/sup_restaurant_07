"""
config/settings.py
------------------
Central Django configuration.
All other files connect through DJANGO_SETTINGS_MODULE=config.settings
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# BASE
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-change-me-in-production-use-env-variable"

# Allow enabling debug via environment for development in Codespaces/Codespaces preview
# (set DJANGO_DEBUG=0 in production environments)
DEBUG = os.environ.get("DJANGO_DEBUG", "1") not in ("0", "False", "false")

# Allow all hosts for development; override in production via env or settings
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# ---------------------------------------------------------------------------
# APPLICATIONS
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "daphne",
    "channels",
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework.authtoken",

    # ← Our app (connects supermarket/models.py, migrations, admin)
    "core",
]

# ---------------------------------------------------------------------------
# MIDDLEWARE
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "config.middleware.ViteProxyMiddleware",
]

# ---------------------------------------------------------------------------
# ROUTING
# Connects → config/urls.py
# ---------------------------------------------------------------------------
ROOT_URLCONF = "config.urls"
LOGIN_URL = "/staff/login/"

# ---------------------------------------------------------------------------
# TEMPLATES  (needed for /admin/)
# ---------------------------------------------------------------------------
##TEMPLATES = [
##    {
#        "BACKEND": "django.template.backends.django.DjangoTemplates",
#        "DIRS": [BASE_DIR.parent / "frontend" / "templates"],
#        "APP_DIRS": True,
#        "OPTIONS": {
#            "context_processors": [
#                "django.template.context_processors.debug",
#                "django.template.context_processors.request",
#                "django.contrib.auth.context_processors.auth",
#                "django.contrib.messages.context_processors.messages",
#            ],
#        },
#    },
#]



TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ---------------------------------------------------------------------------
# WSGI / ASGI
# ---------------------------------------------------------------------------
WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# DATABASE
# Default: SQLite (good for development)
# For production switch to PostgreSQL — just change this block.
# ---------------------------------------------------------------------------
# DATABASES = {
#    "default": {
#        "ENGINE": "django.db.backends.sqlite3",
#        "NAME": BASE_DIR / "db.sqlite3",
#    }
# }

# PostgreSQL configuration for Docker Compose.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "django_db"),
        "USER": os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# ---------------------------------------------------------------------------
# CACHE
# Used by auth.py to store Bearer tokens (key-value, TTL-based).
# In production replace with Redis.
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "restaurant-token-cache",
    }
}

# Redis example (install django-redis first):
# CACHES = {
#     "default": {
#         "BACKEND": "django_redis.cache.RedisCache",
#         "LOCATION": "redis://127.0.0.1:6379/1",
#     }
# }

# ---------------------------------------------------------------------------
# PASSWORD VALIDATION
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# LOCALISATION
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# STATIC FILES
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# STATICFILES_DIRS = [BASE_DIR.parent / "frontend" / "static"]

STATICFILES_DIRS = [BASE_DIR / "frontend" / "static"]

VITE_DEV_SERVER_URL = "http://frontend:5173"

# ---------------------------------------------------------------------------
# DEFAULT PRIMARY KEY
# ---------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

