"""Helpers for Phase 1C router tests.

Each chunk's router tests mount their own router on a fresh
``FastAPI`` instance. The full ``app.main`` lifespan is heavy
(plugin discovery, voice cache, data-dir migration breadcrumbs)
and not needed to exercise a single router — and the user's
plan defers ``app.main`` registration to chunk 1C-E.

The helper wires the same global exception handlers that
``app.main`` registers so error-status-code mapping (404 / 409 /
400) behaves identically to the production app.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.exceptions import AdaptiveLearnerError
from app.main import adaptive_learner_error_handler, global_exception_handler


def make_app(*routers: APIRouter, prefix: str = "/api") -> FastAPI:
    """Build a minimal FastAPI app with the given routers + the
    project-wide exception handlers."""
    test_app = FastAPI()
    for router in routers:
        test_app.include_router(router, prefix=prefix)
    test_app.add_exception_handler(AdaptiveLearnerError, adaptive_learner_error_handler)
    test_app.add_exception_handler(Exception, global_exception_handler)
    return test_app


def make_client(*routers: APIRouter, prefix: str = "/api") -> TestClient:
    return TestClient(make_app(*routers, prefix=prefix))
