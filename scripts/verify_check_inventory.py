#!/usr/bin/env python3
"""Fail when an inventoried check is silently unwired or degraded (#2077).

Precedent: in ``verify_docs.py`` the test-count arithmetic and the README
badge cross-check stopped matching after a reflow dropped the bold from
``= **10293 tests**``. The check still ran, emitted a WARN and returned -
alive-looking, enforcing nothing. Nothing in the repo said so.

``.claude/rules/checks.yaml`` is the declaration surface. This script
proves every ``status: active`` entry is actually wired, using the probe
declared with it:

``make_target=<name>``  the Makefile target exists and is not a stub (it
                        has a prerequisite or a recipe line that is not an
                        echo)
``script_exists=<path>`` the script file exists
``called_in=<file>::<symbol>`` the symbol is called there, not just defined
``no_warn=<substring>`` running ``verify_docs.py`` must NOT emit a warning
                        containing the substring - the exact signature of a
                        check that degraded into a no-op
``ci_step=<workflow>::<job>::<step name>::<needle>`` (#3241) the workflow
                        file has that job, the job has a step of exactly
                        that name, and the step's ``run`` invokes the
                        check (``needle`` is a substring of it, a script
                        name or a make target). The report line names the
                        workflow's triggers and the job's and the step's
                        ``if``: the conditions under which the step is
                        skipped are part of the proof.
``precommit_hook=<id>`` (#3241) the hook exists in ``.pre-commit-config.yaml``
                        and the CI pre-commit job does not list it in
                        ``SKIP``, so ``pre-commit run --all-files`` executes
                        it on every PR and push.
``none``                only allowed for ``status: disabled``

Several probes join with `` | `` (a pipe between spaces). Existence probes (``make_target``,
``script_exists``, ``called_in``, ``no_warn``) prove a check can run; an
active entry must ALSO carry at least one run proof (``ci_step`` or
``precommit_hook``), because a guard file that no step executes is the
silent gate #3241 found (a test the selective runner never selected).

A ``disabled`` entry must carry a reason. Turning a check off stays
possible; doing it silently does not.

Usage::

    python3 scripts/verify_check_inventory.py
    python3 scripts/verify_check_inventory.py --repo-root /path/to/tree

Exit codes: 0 ok, 1 drift.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


def parse_inventory(path: Path) -> list[dict[str, str]]:
    """Read the fixed-shape ``checks:`` list (stdlib only, no PyYAML)."""
    entries: list[dict[str, str]] = []
    current: dict[str, str] = {}
    key: str | None = None
    in_list = False
    for raw in path.read_text(encoding="utf-8").split("\n"):
        if raw.strip().startswith("#"):
            continue
        if raw.startswith("checks:"):
            in_list = True
            continue
        if not in_list or not raw.strip():
            continue
        stripped = raw.strip()
        if stripped.startswith("- "):
            if current:
                entries.append(current)
            current, key = {}, None
            stripped = stripped[2:]
        if re.match(r"^[a-z_]+:", stripped):
            key, _, value = stripped.partition(":")
            key = key.strip()
            value = value.strip()
            current[key] = "" if value in (">-", "|", ">") else value
        elif key:  # folded continuation line
            current[key] = (current[key] + " " + stripped).strip()
    if current:
        entries.append(current)
    return entries


def makefile_targets(root: Path) -> dict[str, bool]:
    """Target name -> whether it does anything (a prerequisite or a recipe
    line beyond ``echo``). A recipe of echoes only is a stub."""
    targets: dict[str, bool] = {}
    current: str | None = None
    for line in (root / "Makefile").read_text(encoding="utf-8").split("\n"):
        match = re.match(r"^([a-zA-Z0-9_-]+):(.*)$", line)
        if match:
            current = match.group(1)
            prerequisites = match.group(2).split("#")[0].strip()
            targets[current] = bool(prerequisites)
            continue
        if current and line.startswith("\t"):
            command = line.strip().lstrip("@-+")
            if command and not command.startswith("echo"):
                targets[current] = True
        elif line.strip() == "":
            current = None
    return targets


RUN_PROOF_KINDS = ("ci_step", "precommit_hook")


class Step:
    def __init__(self, name: str) -> None:
        self.name = name
        self.condition = ""
        self.run: list[str] = []
        self.env: dict[str, str] = {}


class Job:
    def __init__(self) -> None:
        self.condition = ""
        self.steps: list[Step] = []


class Workflow:
    def __init__(self) -> None:
        self.events: list[str] = []
        self.jobs: dict[str, Job] = {}


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def parse_workflow(path: Path) -> Workflow:
    """A fixed-shape reading of a GitHub workflow (stdlib, no PyYAML): the
    ``on:`` events, each job's ``if``, each step's name, ``if``, ``run`` and
    ``env``. Steps are ``- name:`` items; a folded ``if: >-`` and a block
    ``run: |`` continue on deeper-indented lines."""
    workflow = Workflow()
    section: str | None = None
    job: Job | None = None
    step: Step | None = None
    pending: str | None = None
    pending_indent = 0
    in_env = False
    for raw in path.read_text(encoding="utf-8").split("\n"):
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = _indent(raw)
        stripped = raw.strip()
        if indent == 0:
            section = stripped.rstrip(":") if stripped.endswith(":") else None
            job = step = pending = None
            continue
        if section == "on" and indent == 2 and re.match(r"^[a-z_]+:", stripped):
            workflow.events.append(stripped.split(":")[0])
            continue
        if section != "jobs":
            continue
        if pending is not None and indent > pending_indent:
            if pending == "run" and step is not None:
                step.run.append(stripped)
            elif pending == "if" and step is not None:
                step.condition = (step.condition + " " + stripped).strip()
            elif pending == "job-if" and job is not None:
                job.condition = (job.condition + " " + stripped).strip()
            continue
        pending = None
        if indent == 2 and re.match(r"^[a-zA-Z0-9_-]+:\s*$", stripped):
            job = Job()
            workflow.jobs[stripped.rstrip(":")] = job
            step = None
            continue
        if job is None:
            continue
        if indent == 4 and stripped.startswith("if:") and step is None:
            value = stripped[3:].strip()
            job.condition = "" if value in (">-", ">", "|", "|-") else value
            pending, pending_indent = "job-if", 4
            continue
        if indent == 6 and stripped.startswith("- "):
            item = stripped[2:]
            step = Step(item[5:].strip() if item.startswith("name:") else "")
            job.steps.append(step)
            in_env = False
            continue
        if step is None or indent < 8:
            continue
        if indent == 8:
            in_env = stripped.startswith("env:")
            key, _, value = stripped.partition(":")
            value = value.strip()
            if key == "name":
                step.name = value
            elif key == "if":
                step.condition = "" if value in (">-", ">", "|") else value
                pending, pending_indent = "if", 8
            elif key == "run":
                step.run = [] if value in ("|", ">", "|-", ">-") else [value]
                pending, pending_indent = "run", 8
        elif in_env and indent == 10:
            key, _, value = stripped.partition(":")
            step.env[key.strip()] = value.strip().strip('"')
    return workflow


def precommit_hook_ids(root: Path) -> set[str]:
    text = (root / ".pre-commit-config.yaml").read_text(encoding="utf-8")
    return set(re.findall(r"^\s+- id:\s*([a-zA-Z0-9_-]+)", text, re.MULTILINE))


def ci_skipped_hooks(root: Path) -> set[str] | None:
    """The hooks the CI pre-commit job skips, or ``None`` when no step runs
    ``pre-commit run`` at all (then nothing proves any hook runs in CI)."""
    ci = root / ".github" / "workflows" / "ci.yml"
    if not ci.is_file():
        return None
    for job in parse_workflow(ci).jobs.values():
        for step in job.steps:
            if any("pre-commit run" in line for line in step.run):
                skip = step.env.get("SKIP", "")
                return {hook.strip() for hook in skip.split(",") if hook.strip()}
    return None


def probe_ci_step(root: Path, cid: str, value: str, problems: list[str]) -> str | None:
    """Prove the named step exists and invokes the check; return the report
    line (triggers and conditions) or ``None`` after recording the drift."""
    parts = value.split("::")
    if len(parts) != 4:
        problems.append(f"{cid}: ci_step needs <workflow>::<job>::<step>::<needle>, got {value!r}")
        return None
    workflow_path, job_id, step_name, needle = parts
    path = root / workflow_path
    if not path.is_file():
        problems.append(f"{cid}: declared active, but workflow {workflow_path} does not exist")
        return None
    workflow = parse_workflow(path)
    job = workflow.jobs.get(job_id)
    if job is None:
        problems.append(f"{cid}: declared active, but {workflow_path} has no job '{job_id}'")
        return None
    step = next((candidate for candidate in job.steps if candidate.name == step_name), None)
    if step is None:
        problems.append(
            f"{cid}: declared active, but job '{job_id}' in {workflow_path} has no step named "
            f"'{step_name}' - the check may not run at all"
        )
        return None
    if not any(needle in line for line in step.run):
        problems.append(
            f"{cid}: declared active, but step '{step_name}' in {workflow_path} does not run "
            f"'{needle}' - the step exists, the check is not in it"
        )
        return None
    events = ",".join(workflow.events) or "(no trigger parsed)"
    job_if = f"; job if: {job.condition}" if job.condition else ""
    step_if = f"; step if: {step.condition}" if step.condition else "; step if: always"
    return f"{cid}: {workflow_path} [{job_id}] '{step_name}' on {events}{job_if}{step_if}"


def run_verify_docs(root: Path, script: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
        cwd=root,
    )
    return result.stdout + result.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root", default=None, help="check a different tree (used by the RED tests)"
    )
    parser.add_argument(
        "--docs-script",
        default=None,
        help="verify_docs.py to probe (a deliberately broken copy, for the RED test)",
    )
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    inventory = root / ".claude" / "rules" / "checks.yaml"
    if not inventory.is_file():
        print(f"missing inventory: {inventory}", file=sys.stderr)
        return 1

    entries = parse_inventory(inventory)
    problems: list[str] = []
    targets = makefile_targets(root)
    docs_output: str | None = None
    hooks = precommit_hook_ids(root) if (root / ".pre-commit-config.yaml").is_file() else set()
    skipped = ci_skipped_hooks(root)
    run_proofs: list[str] = []

    for entry in entries:
        cid = entry.get("id", "<unnamed>")
        status = entry.get("status", "")
        probe = entry.get("probe", "")

        if status not in ("active", "disabled"):
            problems.append(f"{cid}: status must be 'active' or 'disabled', got {status!r}")
            continue
        if status == "disabled":
            if not entry.get("reason"):
                problems.append(
                    f"{cid}: declared disabled without a reason - state WHY, in the file"
                )
            continue
        if not entry.get("rule"):
            problems.append(
                f"{cid}: active check without a 'rule' field (use '-' when it guards a mechanism)"
            )
        if probe in ("", "none"):
            problems.append(
                f"{cid}: active check needs a probe; 'none' is only allowed for disabled checks"
            )
            continue

        probes = [part.strip() for part in probe.split(" | ") if part.strip()]
        if not any(part.partition("=")[0] in RUN_PROOF_KINDS for part in probes):
            problems.append(
                f"{cid}: active check without a run proof (ci_step or precommit_hook) - "
                f"existence is not execution (#3241)"
            )
        for part in probes:
            kind, _, value = part.partition("=")
            if kind == "make_target":
                if value not in targets:
                    problems.append(
                        f"{cid}: declared active, but Makefile target '{value}' does not exist"
                    )
                elif not targets[value]:
                    problems.append(
                        f"{cid}: declared active, but Makefile target '{value}' is a stub "
                        f"(no prerequisite, no command beyond echo)"
                    )
            elif kind == "script_exists":
                if not (root / value).is_file():
                    problems.append(f"{cid}: declared active, but {value} does not exist")
            elif kind == "called_in":
                where, _, symbol = value.partition("::")
                text = (
                    (root / where).read_text(encoding="utf-8") if (root / where).is_file() else ""
                )
                if not re.search(rf"^\s+{re.escape(symbol)}\(", text, re.MULTILINE):
                    problems.append(
                        f"{cid}: declared active, but {symbol} is never called in {where}"
                    )
            elif kind == "no_warn":
                if docs_output is None:
                    docs_script = (
                        Path(args.docs_script)
                        if args.docs_script
                        else root / "scripts" / "verify_docs.py"
                    )
                    docs_output = run_verify_docs(root, docs_script)
                # A probe that cannot RUN must never count as "no warning found" -
                # that is the very silent-pass this gate exists to prevent.
                if "checks run" not in docs_output:
                    problems.append(
                        f"{cid}: probe could not be evaluated - verify_docs.py did not complete "
                        f"(a crashed probe is not a passing probe)"
                    )
                    continue
                for line in docs_output.split("\n"):
                    if "[WARN" in line and value in line:
                        problems.append(
                            f"{cid}: declared active, but it degraded into a no-op - verify_docs warns: {line.strip()}"
                        )
                        break
            elif kind == "ci_step":
                report = probe_ci_step(root, cid, value, problems)
                if report:
                    run_proofs.append(report)
            elif kind == "precommit_hook":
                if value not in hooks:
                    problems.append(
                        f"{cid}: declared active, but .pre-commit-config.yaml has no hook '{value}'"
                    )
                elif skipped is None:
                    problems.append(
                        f"{cid}: declared active, but no CI step runs 'pre-commit run' - "
                        f"hook '{value}' is proven for local commits only"
                    )
                elif value in skipped:
                    problems.append(
                        f"{cid}: declared active, but the CI pre-commit job SKIPs hook '{value}'"
                    )
                else:
                    run_proofs.append(
                        f"{cid}: .pre-commit-config.yaml hook '{value}' via the ci.yml "
                        f"pre-commit job on every PR and push"
                    )
            else:
                problems.append(f"{cid}: unknown probe kind {kind!r}")

    for problem in problems:
        print(f"CHECK-INVENTORY DRIFT: {problem}", file=sys.stderr)
    if problems:
        print(f"\n{len(problems)} problem(s)", file=sys.stderr)
        return 1

    active = sum(1 for e in entries if e.get("status") == "active")
    off = sum(1 for e in entries if e.get("status") == "disabled")
    for line in run_proofs:
        print(f"  runs: {line}")
    steps = sum(1 for line in run_proofs if ".yml [" in line)
    print(
        f"check inventory OK: {active} active checks proven wired, {off} declared off with a "
        f"reason; {len(run_proofs)} run proofs ({steps} workflow steps, "
        f"{len(run_proofs) - steps} pre-commit hooks)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
