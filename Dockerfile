FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WEB_MODE=true \
    PORT=10000

# Install system dependencies for PostgreSQL driver
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Create necessary runtime directories
RUN mkdir -p /app/uploads /app/backups

EXPOSE 10000 5000

# Shell form binds dynamically to Render's injected $PORT
CMD sh -c "gunicorn app:app --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:${PORT:-10000}"
