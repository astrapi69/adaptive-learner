"""OpenAPI/Swagger metadata: tag catalogue + route-metadata backfill.

FastAPI auto-generates ``/api/docs`` (Swagger) and ``/api/redoc``, but the
bare schema has no tag grouping and many operations have no summary. This
module supplies:

  - ``OPENAPI_TAGS`` — the tag catalogue (name + description) shown as the
    grouped, documented sections in Swagger/ReDoc.
  - ``derive_tag`` — map a request path to its canonical tag.
  - ``ensure_route_metadata`` — backfill EVERY API route that lacks a tag
    or summary with a sensible, path/name-derived value, so no operation
    ships undocumented. Headline endpoints still set explicit, richer
    ``summary`` / ``description`` on their decorators; this only fills the
    long tail (and is idempotent — it never overwrites an explicit value).

``ensure_route_metadata`` runs both at import time (core routers) and in
the lifespan after plugins mount (plugin routers), so the schema is fully
tagged + summarised before the first ``/openapi.json`` request.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from enum import Enum

    from fastapi import FastAPI

# Tag catalogue. Order here is the order sections appear in Swagger/ReDoc.
OPENAPI_TAGS: list[dict[str, str]] = [
    {
        "name": "AI",
        "description": "AI-provider calls for learning sessions (Anthropic / OpenAI / Gemini). Rate-limited.",
    },
    {
        "name": "Sessions",
        "description": "Seven-step learning sessions: start, rate, end, method switching, pronunciation.",
    },
    {
        "name": "Content",
        "description": "Content-set discovery, download, and lesson delivery (content-loader plugin).",
    },
    {
        "name": "Import/Analysis",
        "description": "Chat-history import and AI analysis into a learning profile / lesson.",
    },
    {
        "name": "Settings",
        "description": "Per-user settings, AI provider + API-key management, plugin settings.",
    },
    {"name": "Backup", "description": "Full-database backup export and restore."},
    {"name": "Gamification", "description": "XP, levels, badges, streaks, and daily missions."},
    {"name": "Anki", "description": "AI-extracted flashcards and .apkg export."},
    {"name": "NotebookLM", "description": "Active-recall study questions and study-guide export."},
    {
        "name": "Learning Repo",
        "description": "Git-backed Markdown learning repository (render / export / persist).",
    },
    {"name": "Sync", "description": "Local-network sync of the full data surface between devices."},
    {"name": "Curriculum", "description": "Curricula, topics, and lessons CRUD."},
    {"name": "Projects", "description": "Learning projects and their profiles."},
    {"name": "Users", "description": "User accounts and identity."},
    {"name": "Taxonomy", "description": "Subjects, tags, and project taxonomy."},
    {
        "name": "Progress",
        "description": "Lesson progress, element-level errors, and the SRS review queue.",
    },
    {
        "name": "Assessment",
        "description": "Six-method assessment questionnaire and profile evaluation.",
    },
    {"name": "Tracking", "description": "Progress commits and dashboard aggregation."},
    {"name": "Tools", "description": "Method-tailored tool recommendations and spaced practice."},
    {"name": "Pronunciation", "description": "Pronunciation practice and scoring."},
    {
        "name": "System",
        "description": "Health, version, i18n, plugin diagnostics, and other utility endpoints.",
    },
]

# Ordered (substring, tag) rules — first match wins. Specific before
# general (e.g. session ``/message`` is AI, the rest of session is
# Sessions; settings before the generic fallbacks).
_TAG_RULES: list[tuple[str, str]] = [
    ("/api/ai/", "AI"),
    ("/plugins/content-loader/", "Content"),
    ("/plugins/learning-repo/", "Learning Repo"),
    ("/plugins/gamification/", "Gamification"),
    ("/plugins/missions/", "Gamification"),
    ("/plugins/anki/", "Anki"),
    ("/plugins/notebooklm/", "NotebookLM"),
    ("/plugins/assessment/", "Assessment"),
    ("/plugins/tracking/", "Tracking"),
    ("/plugins/tools/", "Tools"),
    ("/pronunciation", "Pronunciation"),
    ("/plugins/session/", "Sessions"),
    ("/import", "Import/Analysis"),
    ("/plugin-settings", "Settings"),
    ("/settings", "Settings"),
    ("/backup", "Backup"),
    ("/sync", "Sync"),
    ("/lesson-progress", "Progress"),
    ("/element-errors", "Progress"),
    ("/curricul", "Curriculum"),
    ("/topics", "Curriculum"),
    ("/lessons", "Curriculum"),
    ("/subjects", "Taxonomy"),
    ("/tags", "Taxonomy"),
    ("/taxonomy", "Taxonomy"),
    ("/projects", "Projects"),
    ("/users", "Users"),
]


# Session message/stream are AI, not generic Sessions.
def derive_tag(path: str) -> str:
    """Return the canonical OpenAPI tag for a request path."""
    if "/plugins/session/" in path and (path.endswith("/message") or "/message/stream" in path):
        return "AI"
    if path.endswith("/analyze"):
        return "Import/Analysis"
    for needle, tag in _TAG_RULES:
        if needle in path:
            return tag
    return "System"


def _prettify(name: str) -> str:
    """Turn a handler function name into a human summary.

    ``list_projects`` -> ``List projects``;
    ``get_user_endpoint`` -> ``Get user``.
    """
    cleaned = name
    for suffix in ("_endpoint", "_route", "_handler"):
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)]
    words = cleaned.replace("_", " ").strip()
    if not words:
        return "Endpoint"
    return words[0].upper() + words[1:]


_CANONICAL_TAGS = frozenset(tag["name"] for tag in OPENAPI_TAGS)


def ensure_route_metadata(app: FastAPI) -> None:
    """Normalise tags to the canonical catalogue + backfill summaries.

    For every API route:
      - keep any tags already in ``OPENAPI_TAGS`` (an explicit canonical
        tag wins); otherwise replace the route's tags with the single
        path-derived canonical tag. This both backfills untagged core
        routes AND remaps the plugin routers' own lowercase tags
        (``content-loader`` -> ``Content`` etc.) so Swagger groups by the
        documented catalogue, never a bare/unknown section.
      - fill an empty ``summary`` from the handler name (explicit
        summaries are preserved).

    Idempotent; safe to call at import time (core routers) and again in
    the lifespan (plugin routers).

    Mechanics under FastAPI >= 0.141 (#2625): every ``include_router``
    inserts an ``_IncludedRouter`` whose route contexts SNAPSHOT the
    route's tags/summary the first time they are built, and the OpenAPI
    builder reads those cached snapshots — mutating the underlying
    ``APIRoute`` objects no longer reaches the schema. So this does two
    things: it still mutates the original routes (so direct route
    introspection agrees), and it wraps ``app.openapi`` so the SERVED
    schema gets the same normalisation as a post-processing step over
    the finished document — immune to any router-level caching.
    """
    name_by_operation: dict[str, str] = {}
    for context in iter_api_routes(app):
        new_tags: list[str | Enum] = [
            tag for tag in (context.tags or []) if tag in _CANONICAL_TAGS
        ] or [derive_tag(context.path)]
        original = context.original_route
        original.tags = new_tags
        if not original.summary:
            original.summary = _prettify(context.name)
        operation_id = getattr(context, "operation_id", None) or getattr(context, "unique_id", None)
        if operation_id:
            name_by_operation[operation_id] = context.name
    _install_schema_backfill(app, name_by_operation)


def _install_schema_backfill(app: FastAPI, name_by_operation: dict[str, str]) -> None:
    """Wrap ``app.openapi`` so the served schema carries canonical tags.

    Idempotent: re-installing replaces the previous wrapper's mapping but
    never stacks wrappers (the original builder is remembered on the app
    instance). Clears ``app.openapi_schema`` so an already-cached schema
    is rebuilt through the wrapper.
    """
    original_openapi = getattr(app, "_openapi_before_metadata", None) or app.openapi
    app._openapi_before_metadata = original_openapi  # type: ignore[attr-defined]

    def openapi_with_canonical_tags() -> dict:
        schema = original_openapi()
        for path, operations in schema.get("paths", {}).items():
            for operation in operations.values():
                if not isinstance(operation, dict):
                    continue
                tags = [tag for tag in operation.get("tags", []) if tag in _CANONICAL_TAGS] or [
                    derive_tag(path)
                ]
                operation["tags"] = tags
                if not operation.get("summary"):
                    handler = name_by_operation.get(operation.get("operationId", ""))
                    if handler:
                        operation["summary"] = _prettify(handler)
        return schema

    app.openapi = openapi_with_canonical_tags  # type: ignore[method-assign]
    app.openapi_schema = None


def iter_api_routes(app: FastAPI):
    """Yield a route context for every API route on ``app``, flattened.

    FastAPI 0.141 stopped copying an included router's routes into
    ``app.routes``; ``include_router`` now inserts an ``_IncludedRouter``
    node, and the routes only surface through route contexts — with the
    include-prefix applied to ``context.path`` (the raw
    ``original_route.path`` is UNPREFIXED, e.g. ``/progress/{id}``
    instead of ``/api/plugins/tracking/progress/{id}``). Flat iteration
    over ``app.routes`` therefore misses every included router, and
    reading ``original_route.path`` yields the wrong paths (#2625).

    This delegates to ``fastapi.routing.iter_route_contexts`` — the same
    public utility ``get_openapi`` uses — so the paths seen here are
    exactly the ones the schema and the request matcher see. Each yielded
    context carries ``path`` / ``tags`` / ``summary`` / ``name`` /
    ``original_route``. It is the ONE sanctioned way to introspect the
    route table (``ensure_route_metadata`` and the route-catalogue tests
    both use it).
    """
    from fastapi.routing import APIRoute, iter_route_contexts

    for context in iter_route_contexts(app.routes):
        if isinstance(getattr(context, "original_route", None), APIRoute):
            yield context
