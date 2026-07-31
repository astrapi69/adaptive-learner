"""launcher.example.json is a VERIFIED starting point, not a guess (#2121).

The 0.21.x field session showed the wiring keys are easy to get wrong from
outside the repo (env_port_key must be ADAPTIVE_LEARNER_PUBLIC_PORT, not
the launcher default APP_PORT). The example config for wrapper/local-test
setups is pinned here against the SHIPPED launcher/launcher.json, so the
two can never drift apart - and it carries no version literal, so it can
never join the derived-version-pin class either.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SHIPPED = REPO_ROOT / "launcher" / "launcher.json"
EXAMPLE = REPO_ROOT / "launcher" / "launcher.example.json"

# The wiring keys the field session proved easy to get wrong; the example
# must carry exactly the shipped values for these.
PINNED_WIRING_KEYS = (
    "app_slug",
    "compose_file",
    "default_port",
    "env_port_key",
    "env_internal_port_keys",
    "health_check_path",
    "health_check_key",
    "health_check_value",
)


def test_example_exists_and_is_valid_json() -> None:
    assert EXAMPLE.is_file(), "launcher/launcher.example.json is missing (#2121)"
    json.loads(EXAMPLE.read_text(encoding="utf-8"))


def test_example_wiring_keys_match_the_shipped_config() -> None:
    shipped = json.loads(SHIPPED.read_text(encoding="utf-8"))
    example = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    for key in PINNED_WIRING_KEYS:
        assert key in example, f"example misses wiring key {key}"
        assert example[key] == shipped[key], (
            f"example {key}={example[key]!r} drifted from shipped {shipped[key]!r}"
        )


def test_example_declares_a_local_test_identity() -> None:
    """A copied example must not collide with the real installation."""
    example = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    shipped = json.loads(SHIPPED.read_text(encoding="utf-8"))
    for key in ("container_name", "compose_project", "config_dir"):
        assert example[key] != shipped[key], (
            f"example {key} equals the shipped value - a local test instance "
            "would collide with the real installation"
        )
    assert example["update_check_enabled"] is False


def test_example_carries_no_version_literal() -> None:
    """No vX.Y.Z / X.Y.Z literal: the example must never become a drift site."""
    text = EXAMPLE.read_text(encoding="utf-8")
    assert not re.search(r'"(app_version|image_reference)"', text)
    assert not re.search(r"\b\d+\.\d+\.\d+\b", text)
