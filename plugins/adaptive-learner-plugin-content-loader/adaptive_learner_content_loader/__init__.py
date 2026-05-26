"""Adaptive Learner Content-Loader plugin (Phase 43 / EXP-002).

Downloads structured lesson sets from public content repos
(default: ``astrapi69/adaptive-learner-content``) and caches
them so the app works offline after first fetch. Lesson sets
have a versioned manifest; the plugin re-downloads only when
the manifest version exceeds the cached version.

The Content-Loader is the foundation of the v1.27.0
content-repository pivot: it makes the app usable WITHOUT an
API key by providing pre-built lesson sets the user can
browse + download from the public GitHub Pages deployment.

Works in both storage modes:
- API mode: filesystem cache under
  ``get_cache_dir()/content-loader/{source}/{set_id}/v{version}/``.
- Dexie mode: IndexedDB tables (``contentSets`` +
  ``contentSetFiles``) — the GH-Pages-shape build runs the
  whole download + cache flow client-side.

The plugin scaffolds clean at this commit; manifest parser,
GitHub adapter, and cache layer arrive in later commits of
the Phase 43 chain.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-content-loader")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
