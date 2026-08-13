#!/bin/sh
set -e
cd /code

# Wait for PostgreSQL to accept connections before running Django.
# This avoids startup failures when the DB container is still initializing.
python - <<'PY'
import os
import time
import psycopg2
from psycopg2 import OperationalError

host = os.environ.get('POSTGRES_HOST', 'db')
port = int(os.environ.get('POSTGRES_PORT', '5432'))
dbname = os.environ.get('POSTGRES_DB', 'django_db')
user = os.environ.get('POSTGRES_USER', 'postgres')
password = os.environ.get('POSTGRES_PASSWORD', 'postgres')

start = time.time()
while True:
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=3,
        )
        conn.close()
        break
    except OperationalError:
        if time.time() - start > 60:
            raise
        time.sleep(1)
PY

python manage.py migrate --noinput
exec python manage.py runserver 0.0.0.0:8000
