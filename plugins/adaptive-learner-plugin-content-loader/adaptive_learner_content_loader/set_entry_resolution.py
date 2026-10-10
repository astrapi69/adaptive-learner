"""Resolve a set's root-manifest entry and its own manifest's entry (#3722).

A content repository describes each set twice: in the root ``manifest.yaml``
and in the set's own ``manifest.yaml``. Since learn-content-engine#246 the
root entry owns the discovery fields and the set manifests no longer repeat
them, so a consumer that reads only the set manifest loses them. This is the
Python port of the engine's ``resolveSetEntry`` (0.38.0): the plugin runs in
the backend and cannot call the TypeScript engine. The cross-language parity
of the two is #3711.
"""

from __future__ import annotations

from typing import Any

import yaml

ROOT_OWNED_SET_FIELDS: tuple[str, ...] = ("title", "description", "visibility", "review_status")
"""The fields the root entry owns (engine ``ROOT_OWNED_SET_FIELDS``, 0.38.0)."""


def resolve_set_entry(root_entry: dict[str, Any], set_entry: dict[str, Any]) -> dict[str, Any]:
    """Return the one set entry to project from a set's two entries.

    The fields in :data:`ROOT_OWNED_SET_FIELDS` come from the root entry,
    every other field from the set manifest. Either way, a value one entry
    leaves absent or ``None`` is taken from the other, so projection
    defaults apply only when both are silent. Neither input is changed.

    Args:
        root_entry: The set's entry in the root ``manifest.yaml`` (raw mapping).
        set_entry: The entry in the set's own ``manifest.yaml`` (raw mapping).

    Returns:
        A new mapping.

    Raises:
        ValueError: when the two entries describe different sets.

    Example:
        >>> resolve_set_entry({"id": "a", "description": "x"}, {"id": "a"})["description"]
        'x'
    """
    if root_entry.get("id") != set_entry.get("id"):
        raise ValueError(
            f"root entry {root_entry.get('id')!r} and set entry "
            f"{set_entry.get('id')!r} describe different sets"
        )
    resolved = dict(root_entry)
    resolved.update({field: value for field, value in set_entry.items() if value is not None})
    for field in ROOT_OWNED_SET_FIELDS:
        if root_entry.get(field) is not None:
            resolved[field] = root_entry[field]
    return resolved


def resolve_cached_manifest(set_manifest_text: str, root_entry: dict[str, Any]) -> str:
    """The set manifest to cache: its entry for the set resolved against the root entry.

    Only the matching ``sets`` entry changes; ``metadata`` (the lesson list,
    ``retired_ids``) and every other key stay as the set manifest has them.

    Args:
        set_manifest_text: The set's own ``manifest.yaml`` as fetched.
        root_entry: The set's entry in the root manifest (raw mapping, only
            the keys the root actually declares).

    Returns:
        The YAML text to store; the input unchanged when it holds no entry
        for the set.
    """
    document = yaml.safe_load(set_manifest_text) or {}
    entries = document.get("sets")
    if not isinstance(entries, list):
        return set_manifest_text
    for index, entry in enumerate(entries):
        if isinstance(entry, dict) and entry.get("id") == root_entry.get("id"):
            entries[index] = resolve_set_entry(root_entry, entry)
            return yaml.safe_dump(document, allow_unicode=True, sort_keys=False)
    return set_manifest_text
