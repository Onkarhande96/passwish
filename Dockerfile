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

# Create necessary runtime directories and ensure executable permission
RUN mkdir -p /app/uploads /app/backups && chmod +x /app/start.sh

EXPOSE 10000

CMD ["/bin/sh", "/app/start.sh"]
