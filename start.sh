#!/bin/sh
set -e

TARGET_PORT="${PORT:-10000}"
echo "[PassWish] Starting Gunicorn server on ports: ${TARGET_PORT}, 5000, 10000..."

# Bind to PORT, 5000, and 10000 simultaneously so Render proxy connects seamlessly on whichever port it routes to
exec gunicorn app:app \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --bind "0.0.0.0:${TARGET_PORT}" \
    --bind "0.0.0.0:5000" \
    --bind "0.0.0.0:10000"
