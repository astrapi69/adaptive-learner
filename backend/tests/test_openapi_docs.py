"""OpenAPI / Swagger documentation contract tests.

Run against the FULL app (``with TestClient(app)`` so the lifespan
mounts the plugin routes), then assert the generated schema is valid,
fully tagged + summarised, and version-accurate.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import __version__
from app.main import app
from app.openapi_metadata import OPENAPI_TAGS


def _operations(schema: dict):
    """Yield (path, method, operation) for every HTTP operation."""
    http_methods = {"get", "post", "put", "patch", "delete"}
    for path, methods in schema.get("paths", {}).items():
        for method, operation in methods.items():
            if method.lower() in http_methods:
                yield path, method, operation


def test_openapi_schema_valid():
    with TestClient(app) as client:
        resp = client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert schema.get("openapi", "").startswith("3.")
    assert schema["info"]["title"] == "Adaptive Learner API"
    assert schema["info"]["version"]
    assert schema.get("paths"), "schema has no paths"
    # Tag catalogue is attached.
    tag_names = {t["name"] for t in schema.get("tags", [])}
    assert {t["name"] for t in OPENAPI_TAGS} <= tag_names


def test_all_endpoints_have_tags():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    untagged = [
        f"{method.upper()} {path}" for path, method, op in _operations(schema) if not op.get("tags")
    ]
    assert not untagged, f"operations without a tag: {untagged}"


def test_all_endpoints_have_summary():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    missing = [
        f"{method.upper()} {path}"
        for path, method, op in _operations(schema)
        if not (op.get("summary") or "").strip()
    ]
    assert not missing, f"operations without a summary: {missing}"


def test_openapi_version_matches():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == __version__


def test_every_route_tag_is_in_catalogue():
    """Every tag actually used on an operation has a catalogue entry
    (so Swagger shows a description, never a bare/unknown group)."""
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    catalogue = {t["name"] for t in OPENAPI_TAGS}
    used: set[str] = set()
    for _path, _method, op in _operations(schema):
        used.update(op.get("tags", []))
    unknown = used - catalogue
    assert not unknown, f"tags used but not described in OPENAPI_TAGS: {unknown}"


def test_key_request_models_have_examples():
    """The central request bodies carry an example in the schema so the
    Swagger 'Try it out' form is pre-filled."""
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    components = schema.get("components", {}).get("schemas", {})
    for model in ("UserCreate", "ApiKeySetBody", "LearningProjectCreateBody"):
        assert model in components, f"{model} missing from schema components"
        assert components[model].get("example"), f"{model} has no example"


def test_spec_public_while_viewers_debug_gated():
    """/openapi.json is deliberately public; Swagger/ReDoc stay DEBUG-only.

    Decision #2279: the app has no per-request auth, so gating the raw
    spec would be security theatre, while the machine-readable
    description is an integration interface (client generators). The
    interactive viewers remain a DEBUG-only convenience (#2198). If this
    test fails because the spec route was gated, that is the pinned
    intent being "fixed" - read #2279 before changing it.
    """
    from app.main import DEBUG

    assert DEBUG is False, "test env must run with ADAPTIVE_LEARNER_DEBUG unset"
    with TestClient(app) as client:
        assert client.get("/openapi.json").status_code == 200
        assert client.get("/api/docs").status_code == 404
        assert client.get("/api/redoc").status_code == 404
