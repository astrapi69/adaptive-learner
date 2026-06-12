"""Content-source references + plugin-settings parsing.

A :class:`SourceRef` is a pointer to one upstream content repo; the
``*_from_settings`` helpers turn the plugin's YAML settings (the
official ``sources`` list + the connected user repos) into ``SourceRef``
objects for the orchestrator to iterate. Extracted from ``service.py``
so that module is purely the GitHub-adapter + cache orchestrator.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceRef:
    """A pointer to an upstream content repo.

    The plugin settings (``backend/config/plugins/content-loader.yaml``)
    publish a list of these; the orchestrator iterates them.
    """

    source: str  # GitHub owner/name slug
    branch: str = "main"

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.source}@{self.branch}"


def parse_source_refs_from_settings(
    raw_sources: list[dict[str, str]] | None,
) -> list[SourceRef]:
    """Build the SourceRef list from the plugin's YAML settings.

    Defensive: caller passes whatever YAML parsed into. We
    accept malformed entries and skip them with a warning so
    a broken config doesn't crash the plugin at activation
    time.
    """
    refs: list[SourceRef] = []
    if not raw_sources:
        return refs
    for entry in raw_sources:
        if not isinstance(entry, dict):
            continue
        source = entry.get("source")
        branch = entry.get("branch", "main")
        if not source or "/" not in source:
            continue
        refs.append(SourceRef(source=source, branch=branch))
    return refs


def user_source_from_settings(
    user_repo: dict[str, object] | None,
) -> SourceRef | None:
    """Build one connected user repo's SourceRef, or None.

    EXP-023 Phase A — a single connected user content repository
    (Settings > Data) maps to a SourceRef appended to the official
    sources so the list / download / lessons routes serve it too.
    """
    if not isinstance(user_repo, dict) or not user_repo.get("connected"):
        return None
    owner = user_repo.get("owner")
    repo = user_repo.get("repo")
    if not owner or not repo:
        return None
    branch = user_repo.get("branch") or "main"
    return SourceRef(source=f"{owner}/{repo}", branch=str(branch))


def user_sources_from_settings(
    settings: dict[str, object],
) -> list[SourceRef]:
    """Build the connected user repos' SourceRefs (EXP-023 Phase B).

    Reads the ``user_repos`` array, falling back to a single
    legacy ``user_repo`` (Phase A). Returns them in list order
    (precedence: later wins), skipping not-connected / malformed
    entries.
    """
    raw_list = settings.get("user_repos")
    if not isinstance(raw_list, list):
        legacy = settings.get("user_repo")
        raw_list = [legacy] if isinstance(legacy, dict) else []
    refs: list[SourceRef] = []
    for entry in raw_list:
        ref = user_source_from_settings(entry if isinstance(entry, dict) else None)
        if ref is not None:
            refs.append(ref)
    return refs
