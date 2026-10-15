#!/bin/sh
set -e

PORT="${PORT:-10000}"
echo "[PassWish] Starting Gunicorn on port: ${PORT}..."

exec gunicorn app:app \
    --workers 1 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --bind "0.0.0.0:${PORT}"
