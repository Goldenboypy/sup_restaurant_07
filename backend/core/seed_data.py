"""
Management command: seed the baseline accounts and fixtures needed to
actually run and test the system.

Usage:
    python manage.py seed_data
    python manage.py seed_data --tables 12 --seats 6

Deliberately OUT of scope here (by design, not an oversight):
    Menu categories, menu items, and the legacy supermarket Category /
    Product / Branch catalog are NOT seeded by this command. In a real
    deployment that content is entered and maintained by staff through
    the Django Admin (/admin/), not baked into a script that silently
    runs on every fresh environment. Seeding demo catalog data here
    would mean every environment -- including production -- ends up
    carrying throwaway placeholder products, which is exactly the kind
    of thing that leaks into a live database by accident.

What IS seeded here, and why each one is NOT catalog content:
    - One superuser account   -- needed just to open /admin/ at all
    - One demo Waiter account -- so the Staff App has something to log
                                  in as; a person, not a product
    - A handful of Tables     -- physical furniture/fixtures. Without at
                                  least one Table (and its QR token) the
                                  Guest App has nothing to scan and the
                                  whole dine-in flow is untestable.

Credentials:
    Nothing is hardcoded. Passwords are read from environment variables,
    with a securely random fallback generated for local development only
    (printed once so a developer can actually log in). Running this
    command against a non-DEBUG environment without the env vars set
    explicitly raises instead of silently creating a guessable account.
"""
from __future__ import annotations

import os
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Table, Waiter

User = get_user_model()

DEFAULT_TABLE_COUNT = 8
DEFAULT_TABLE_SEATS = 4


class Command(BaseCommand):
    help = "Seed baseline accounts + table fixtures (no catalog content -- use /admin/ for that)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tables",
            type=int,
            default=DEFAULT_TABLE_COUNT,
            help=f"Number of demo tables to ensure exist (default: {DEFAULT_TABLE_COUNT}).",
        )
        parser.add_argument(
            "--seats",
            type=int,
            default=DEFAULT_TABLE_SEATS,
            help=f"Seats per newly created table (default: {DEFAULT_TABLE_SEATS}).",
        )

    def handle(self, *args, **options) -> None:
        self._guard_against_unsafe_production_seed()

        with transaction.atomic():
            self._seed_admin()
            self._seed_waiter()
            self._seed_tables(count=options["tables"], seats=options["seats"])

        self.stdout.write(self.style.SUCCESS("\nSeed complete."))
        self.stdout.write(f"  Users   : {User.objects.count()}")
        self.stdout.write(f"  Waiters : {Waiter.objects.count()}")
        self.stdout.write(f"  Tables  : {Table.objects.count()}")
        self.stdout.write(
            self.style.WARNING(
                "  Menu categories/items are managed via /admin/ -- not seeded by this command."
            )
        )

    # ------------------------------------------------------------------
    def _guard_against_unsafe_production_seed(self) -> None:
        """Refuse to silently create guessable accounts outside local dev."""
        if settings.DEBUG:
            return
        if os.environ.get("SEED_ADMIN_PASSWORD") and os.environ.get("SEED_WAITER_PASSWORD"):
            return
        raise CommandError(
            "Refusing to seed a non-DEBUG environment without SEED_ADMIN_PASSWORD "
            "and SEED_WAITER_PASSWORD set explicitly. Set both env vars and retry."
        )

    def _seed_admin(self) -> None:
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write("  [admin]    already exists, skipping")
            return

        password = os.environ.get("SEED_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
        admin = User.objects.create_superuser(
            username=os.environ.get("SEED_ADMIN_USERNAME", "admin"),
            email=os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com"),
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(f"  [admin]    created -> {admin.username}"))
        if not os.environ.get("SEED_ADMIN_PASSWORD"):
            self.stdout.write(self.style.WARNING(f"             generated password: {password}"))

    def _seed_waiter(self) -> None:
        username = os.environ.get("SEED_WAITER_USERNAME", "waiter1")
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"  [waiter]   {username} already exists, skipping")
            return

        password = os.environ.get("SEED_WAITER_PASSWORD") or secrets.token_urlsafe(12)
        waiter_user = User.objects.create_user(
            username=username,
            email=os.environ.get("SEED_WAITER_EMAIL", f"{username}@example.com"),
            password=password,
            first_name="Demo",
            last_name="Waiter",
        )
        Waiter.objects.get_or_create(user=waiter_user, defaults={"display_name": "Demo Waiter"})
        self.stdout.write(self.style.SUCCESS(f"  [waiter]   created -> {username}"))
        if not os.environ.get("SEED_WAITER_PASSWORD"):
            self.stdout.write(self.style.WARNING(f"             generated password: {password}"))

    def _seed_tables(self, *, count: int, seats: int) -> None:
        existing = Table.objects.count()
        if existing >= count:
            self.stdout.write(f"  [tables]   {existing} already exist, skipping")
            return

        created = 0
        for number in range(1, count + 1):
            _, was_created = Table.objects.get_or_create(number=number, defaults={"seats": seats})
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(f"  [tables]   {created} created ({existing} already existed)")
        )