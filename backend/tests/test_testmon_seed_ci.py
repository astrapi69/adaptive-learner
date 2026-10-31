"""A PR's first backend run finds testmon data from develop (#3901).

Test Impact Analysis (#615) restores ``backend/.testmondata`` on a PR, but
only PR runs wrote it, and a run reads the caches of its own ref and of the
base branch only. Every PR's first run therefore started cold and ran the
whole suite (#3899: 2716 tests in 11:00 against a 15-minute job limit). A
seed job on the develop push writes the data under the prefix the PR step
restores. Pins that wiring: if either key changes alone, the cache is cold
again and nothing turns red.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
TESTMON_PATH = "backend/.testmondata"


def _jobs() -> dict[str, Any]:
    workflow = yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )
    return workflow["jobs"]


def _testmon_cache_step(job: dict[str, Any]) -> dict[str, Any]:
    steps = [
        step
        for step in job["steps"]
        if str(step.get("uses", "")).startswith("actions/cache@")
        and step.get("with", {}).get("path") == TESTMON_PATH
    ]
    assert len(steps) == 1, "expected exactly one testmon cache step"
    return steps[0]


def _seed_job() -> dict[str, Any]:
    jobs = _jobs()
    assert "testmon-seed" in jobs, "the develop push has no testmon seed job"
    return jobs["testmon-seed"]


def test_the_seed_job_runs_on_the_develop_push_only() -> None:
    condition = _seed_job()["if"]
    assert "github.event_name == 'push'" in condition
    assert "github.ref == 'refs/heads/develop'" in condition


def test_the_seed_saves_under_the_prefix_a_pr_restores() -> None:
    pr = _testmon_cache_step(_jobs()["backend-tests"])["with"]
    seed = _testmon_cache_step(_seed_job())["with"]
    assert seed["key"] == pr["key"]
    assert seed["restore-keys"].strip() == pr["restore-keys"].strip()
    assert pr["key"].startswith(pr["restore-keys"].strip())


def test_the_seed_records_with_testmon_from_backend() -> None:
    runs = [step for step in _seed_job()["steps"] if "pytest" in str(step.get("run", ""))]
    assert len(runs) == 1, "the seed job needs exactly one pytest step"
    assert runs[0].get("working-directory") == "backend"
    assert "pytest tests/" in runs[0]["run"]
    assert "--testmon" in runs[0]["run"]


def test_a_cold_seed_fits_its_time_limit() -> None:
    # A cold run with testmon took 11:00 on #3899; the job also installs.
    assert _seed_job()["timeout-minutes"] >= 25


def test_the_develop_merge_run_stays_without_testmon() -> None:
    step = next(
        step
        for step in _jobs()["backend-tests"]["steps"]
        if str(step.get("name", "")).startswith("Run backend tests")
    )
    full_run = step["run"].split("else", 1)[1]
    assert "pytest tests/" in full_run
    assert "--testmon" not in full_run, "the full run on push must stay fast"
