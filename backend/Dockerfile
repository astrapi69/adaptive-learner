# Stage 1: Build - resolve and install all production dependencies
FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir poetry

WORKDIR /build

# Copy backend dependency definitions
COPY backend/pyproject.toml backend/poetry.lock* ./backend/

# Copy local plugin packages (path dependencies in backend/pyproject.toml).
# Glob picks up every plugins/adaptive-learner-plugin-* directory so new plugins do
# not require a Dockerfile change. .dockerignore strips tests and caches.
COPY plugins/ ./plugins/

WORKDIR /build/backend

# Install all production deps via Poetry first (resolves everything correctly)
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root --only main

# Reinstall local plugins as proper packages (not .pth path links).
# Loop matches the COPY glob so any plugin in the tree is installed.
RUN for pkg in ../plugins/adaptive-learner-plugin-*; do \
        pip install --no-cache-dir --force-reinstall --no-deps "$pkg"; \
    done

# Remove .pth files left by Poetry's editable installs
RUN rm -f /usr/local/lib/python3.12/site-packages/adaptive_learner_plugin_*.pth

# Stage 2: Runtime - minimal image without Poetry, pip cache, or dev deps
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends pandoc git && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages and scripts from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /app

# Copy backend application code
COPY backend/ .

# Create non-root user and data directory
RUN groupadd -r adaptive_learner && useradd -r -g adaptive_learner adaptive_learner && \
    mkdir -p /app/data && chown -R adaptive_learner:adaptive_learner /app

USER adaptive_learner

# Default backend port. Override at run time with
# ADAPTIVE_LEARNER_PORT=… and a matching `-p host:port` mapping.
# docker-compose.yml / docker-compose.prod.yml take precedence by
# overriding the CMD via ``command:``.
ENV ADAPTIVE_LEARNER_PORT=18001
EXPOSE 18001

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${ADAPTIVE_LEARNER_PORT:-18001}"]
