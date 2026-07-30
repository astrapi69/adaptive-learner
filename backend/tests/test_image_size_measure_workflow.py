"""Pins the measurement-only workflow (#2151).

Its whole value is what it does NOT do: it reports a size and never
enters it. A workflow that measured and entered in one step would make a
ceiling a side effect of running CI - and #2134 recorded what a ceiling
taken in the wrong place costs.

Five-point contract: it fails closed when the workflow is missing (a file
that is gone is not a passing one) and reports what it examined.
"""

from __future__ import annotations

from pathlib import Path

import pytest

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "image-size-measure.yml"


@pytest.fixture(scope="module")
def text() -> str:
    if not WORKFLOW.is_file():
        pytest.fail(f"{WORKFLOW} is missing - a workflow that is gone is not a passing one")
    return WORKFLOW.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def parsed(text: str) -> dict:
    yaml = pytest.importorskip("yaml")
    return yaml.safe_load(text)


def test_reports_what_it_examined(parsed: dict) -> None:
    jobs = parsed["jobs"]
    assert jobs, "no jobs parsed - the check would pass on an empty file"
    print(f"examined {len(jobs)} job(s): {', '.join(jobs)}")


def test_it_never_writes_a_baseline(text: str) -> None:
    """The point of the whole file: measuring and entering stay separate.

    `--update-baseline` may appear only inside an `echo` that prints the
    copy-paste command for a human - never on a line the runner executes.
    """
    executable = [
        line
        for line in text.splitlines()
        if "--update-baseline" in line and not line.strip().startswith("echo")
    ]
    assert not executable, f"the workflow would enter the ceiling itself: {executable}"


def test_it_is_dispatch_only(parsed: dict) -> None:
    """Measuring on every push would be noise; this is an on-demand answer."""
    triggers = parsed[True] if True in parsed else parsed["on"]
    assert set(triggers) == {"workflow_dispatch"}


def test_it_asserts_a_native_runner(text: str) -> None:
    """A size measured under emulation is a different number (#2136 point 5)."""
    assert "uname -m" in text
    assert "refusing to report an emulated size" in text


def test_it_builds_exactly_one_platform(text: str) -> None:
    """Two platforms produce a manifest that cannot be loaded, hence measured."""
    assert "platforms: linux/${{ inputs.arch }}" in text
    assert "load: true" in text


def _evaluate_runner_expression(expression: str, arch: str) -> object:
    """Evaluate the ``runs-on`` expression with GitHub's operator semantics.

    GitHub expressions return operands, not booleans: ``a && b`` yields
    ``a`` when falsy else ``b``; ``a || b`` yields ``a`` when truthy else
    ``b``; ``&&`` binds tighter than ``||``. Asserting the EFFECT (which
    runner label comes out per architecture) instead of the literal string
    is what run 30531619694 was missing: ``a && b && c`` reads plausibly
    and still sends every architecture to ``c`` (#2163).
    """
    inner = expression.strip()
    assert inner.startswith("${{") and inner.endswith("}}"), inner
    tokens = inner[3:-2].split()

    def atom(token: str) -> object:
        if token == "inputs.arch":
            return arch
        assert token.startswith("'") and token.endswith("'"), token
        return token[1:-1]

    or_parts: list[list[str]] = [[]]
    for token in tokens:
        if token == "||":
            or_parts.append([])
        else:
            or_parts[-1].append(token)

    def eval_and(part: list[str]) -> object:
        value: object = atom(part[0]) if part[1:2] != ["=="] else atom(part[0]) == atom(part[2])
        rest = part[3:] if part[1:2] == ["=="] else part[1:]
        while rest:
            assert rest[0] == "&&", rest
            if not value:
                return value
            value = atom(rest[1])
            rest = rest[2:]
        return value

    result: object = False
    for part in or_parts:
        result = eval_and(part)
        if result:
            return result
    return result


def test_each_arch_reaches_its_native_runner(parsed: dict) -> None:
    """arm64 must land on the arm runner, amd64 on ubuntu-latest (#2163).

    Run 30531619694 proved the broken form fails closed but measures
    nothing: the assert step refused an amd64 runner for an arm64 request,
    so the workflow could never produce the number it exists for.
    """
    expression = parsed["jobs"]["measure"]["runs-on"]
    assert _evaluate_runner_expression(expression, "arm64") == "ubuntu-24.04-arm"
    assert _evaluate_runner_expression(expression, "amd64") == "ubuntu-latest"
