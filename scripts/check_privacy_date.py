#!/usr/bin/env python3
"""A changed privacy policy carries a date no older than its change (#3823).

The policy changed three times in two days (#3809, a register fix, #3805), and
each time someone had to move the date line by hand in eight files. A policy
whose text changes while its date stays is a silent false statement, and the
old date still looks plausible.

For every ``docs/help/<lang>/legal/privacy.md`` that differs from the merge
base of ``--base``, the date line (``Stand:``, ``Last updated:`` and so on)
must parse, and when the text around it changed, the date must be no older
than the change: the author date of the newest commit that touched the file,
or today for a change not committed yet. "No older" and not "different": a
second edit on the day of the first keeps the date that is already right.
A date-only change needs a readable date. The imprint carries no date and is
not checked.

Usage::

    python3 scripts/check_privacy_date.py --base origin/develop [--head <sha>]

Without ``--head`` the working tree is compared, uncommitted changes included.
Exit codes: 0 every changed policy is dated / 1 a finding / 2 cannot check
(no merge base, git failed).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

POLICY_PATHSPEC = "docs/help/*/legal/privacy.md"
POLICY_RE = re.compile(r"^docs/help/(?P<lang>[a-z]{2})/legal/privacy\.md$")

LABELS = {
    "de": "Stand:",
    "en": "Last updated:",
    "es": "Última actualización:",
    "fr": "Dernière mise à jour :",
    "pt": "Última atualização:",
    "el": "Τελευταία ενημέρωση:",
    "ja": "最終更新日:",
    "tr": "Son güncelleme:",
}
MONTHS = {
    "de": "januar februar märz april mai juni juli august september oktober november dezember",
    "en": "january february march april may june july august september october november december",
    "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre",
    "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre",
    "pt": "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro",
    "el": (
        "ιανουαρίου φεβρουαρίου μαρτίου απριλίου μαΐου ιουνίου ιουλίου αυγούστου "
        "σεπτεμβρίου οκτωβρίου νοεμβρίου δεκεμβρίου"
    ),
    "tr": "ocak şubat mart nisan mayıs haziran temmuz ağustos eylül ekim kasım aralık",
}
DAY_MONTH_YEAR = re.compile(r"(\d{1,2})(?:\.|er)?\s+(?:de\s+)?(\S+)\s+(?:de\s+)?(\d{4})")
YEAR_MONTH_DAY = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日")


class CannotCheck(RuntimeError):
    """The comparison has no basis; the run proves nothing."""


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        raise CannotCheck(f"git {' '.join(args)}: {result.stderr.strip()}")
    return result


def parse_date(lang: str, value: str) -> date | None:
    """The date a date line names, or None when it is not one in ``lang``."""
    try:
        if lang == "ja":
            match = YEAR_MONTH_DAY.fullmatch(value)
            return date(int(match[1]), int(match[2]), int(match[3])) if match else None
        match = DAY_MONTH_YEAR.fullmatch(value)
        months = MONTHS[lang].split()
        if not match or match[2].casefold() not in months:
            return None
        return date(int(match[3]), months.index(match[2].casefold()) + 1, int(match[1]))
    except ValueError:
        return None


def split_date(lang: str, text: str) -> tuple[str | None, str]:
    """Return the date line's value and the text without that line."""
    label = LABELS[lang]
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.startswith(label):
            return line[len(label) :].strip(), "\n".join(lines[:index] + lines[index + 1 :])
    return None, text


def changed_policies(merge_base: str, head: str | None) -> list[str]:
    target = [merge_base, head] if head else [merge_base]
    out = git("diff", "--name-only", *target, "--", POLICY_PATHSPEC).stdout
    return sorted(path for path in out.splitlines() if POLICY_RE.match(path))


def change_date(path: str, merge_base: str, head: str | None) -> date:
    """The day the text changed: today if uncommitted, else the newest commit's author date."""
    if head is None and git("diff", "--quiet", "HEAD", "--", path, check=False).returncode:
        return date.today()
    stamp = git(
        "log", "-1", "--no-merges", "--format=%as", f"{merge_base}..{head or 'HEAD'}", "--", path
    ).stdout.strip()
    return date.fromisoformat(stamp) if stamp else date.today()


def check_policy(path: str, merge_base: str, head: str | None) -> list[str]:
    match = POLICY_RE.match(path)
    if match is None:
        return [f"{path}: not a policy path"]
    lang = match["lang"]
    if lang not in LABELS:
        return [f"{path}: no date format known for '{lang}', add it to LABELS and MONTHS"]
    new_text = git("show", f"{head}:{path}").stdout if head else Path(path).read_text("utf-8")
    old = git("show", f"{merge_base}:{path}", check=False)
    old_value, old_body = split_date(lang, old.stdout) if old.returncode == 0 else (None, "")
    new_value, new_body = split_date(lang, new_text)
    if new_value is None:
        return [f"{path}: no date line starting with '{LABELS[lang]}'"]
    new_date = parse_date(lang, new_value)
    if new_date is None:
        return [f"{path}: the date line '{new_value}' is not a date"]
    if new_body == old_body:
        return []
    changed = change_date(path, merge_base, head)
    if new_date < changed:
        moved = "unchanged" if new_value == old_value else f"set to {new_value}"
        return [
            f"{path}: the text changed on {changed.isoformat()}, but the date is {moved} "
            f"({new_date.isoformat()}); move the date line to the day of the change"
        ]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", required=True, help="base revision, e.g. origin/develop")
    parser.add_argument("--head", help="head revision; omit to check the working tree")
    args = parser.parse_args()
    try:
        merge_base = git("merge-base", args.base, args.head or "HEAD").stdout.strip()
        paths = changed_policies(merge_base, args.head)
        findings = [
            finding for path in paths for finding in check_policy(path, merge_base, args.head)
        ]
    except CannotCheck as exc:
        print(f"privacy-date: cannot check, {exc}")
        return 2
    print(
        f"privacy-date: {len(paths)} changed privacy polic{'y' if len(paths) == 1 else 'ies'} "
        f"checked against {args.base} (merge base {merge_base[:9]})"
    )
    for finding in findings:
        print(f"  FAIL {finding}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
