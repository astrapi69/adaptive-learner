# Stage 0: Frontend build - bun-built statics served by FastAPI (#2058).
# Mirrors the retired frontend/Dockerfile build stage (same bun pin as CI).
FROM node:24-slim AS frontend-build

RUN npm install --global bun@1.3.14

WORKDIR /frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ .
RUN bun run build

# Stage 1: Build - resolve and install all production dependencies
FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir poetry

# Runtime dependencies go into their own prefix (#2132). Installing them
# into the interpreter's shared site-packages meant the final stage had to
# copy that whole directory - and dragged poetry, virtualenv, dulwich and
# pip along with it, build tooling nothing at runtime calls.
RUN python -m venv /opt/venv

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
    VIRTUAL_ENV=/opt/venv PATH="/opt/venv/bin:$PATH" \
    poetry install --no-interaction --no-ansi --no-root --only main

# Reinstall local plugins as proper packages (not .pth path links).
# Loop matches the COPY glob so any plugin in the tree is installed.
RUN for pkg in ../plugins/adaptive-learner-plugin-*; do \
        /opt/venv/bin/pip install --no-cache-dir --force-reinstall --no-deps "$pkg"; \
    done

# Remove .pth files left by Poetry's editable installs
RUN rm -f /opt/venv/lib/python3.12/site-packages/adaptive_learner_plugin_*.pth

# Stage 2: Runtime - minimal image without Poetry, pip cache, or dev deps
FROM python:3.12-slim

# git only. It IS a runtime dependency - the Learning Repository plugin
# shells out to it (git_writer.py:65, guarded by shutil.which at :46).
# pandoc was carried for 243 MB (measured: 560 MB with, 317 MB without)
# while `grep -rn pandoc backend/app plugins` returns nothing (#2132).
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Only the runtime prefix crosses over - not the interpreter's shared
# site-packages, which also held the build tooling (#2132).
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy backend application code
COPY backend/ .

# The built frontend statics, served by FastAPI itself (#2058): the
# lifespan mounts them (SPA fallback included) when
# ADAPTIVE_LEARNER_SERVE_FRONTEND is set - single container, no nginx.
COPY --from=frontend-build /frontend/dist /app/static
ENV ADAPTIVE_LEARNER_SERVE_FRONTEND=1
ENV ADAPTIVE_LEARNER_FRONTEND_DIST=/app/static

# Create non-root user and data directory
RUN groupadd -r adaptive_learner && useradd -r -g adaptive_learner adaptive_learner && \
    mkdir -p /app/data && chown -R adaptive_learner:adaptive_learner /app

# The system user (useradd -r) has no usable home, so platformdirs would
# resolve config/cache under /home/adaptive_learner (not writable) and the
# Fernet secret.key creation crashes at startup with EACCES. Point HOME at
# the writable, persisted data volume so ~/.config + ~/.cache land there.
ENV HOME=/app/data

USER adaptive_learner

# Default backend port. Override at run time with
# ADAPTIVE_LEARNER_PORT=… and a matching `-p host:port` mapping.
# docker-compose.yml / docker-compose.prod.yml take precedence by
# overriding the CMD via ``command:``.
ENV ADAPTIVE_LEARNER_PORT=18001
EXPOSE 18001

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${ADAPTIVE_LEARNER_PORT:-18001}"]
