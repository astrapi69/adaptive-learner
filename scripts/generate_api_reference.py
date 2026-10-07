#!/usr/bin/env python3
"""Generate the complete endpoint list of the help API reference (#3454).

Single writer for ``docs/help/<locale>/api/endpoints.md`` in every help
locale (#3652). The list is
rendered from the committed OpenAPI snapshot (``schema/openapi.json``,
written by ``scripts/sync_openapi.py``), so it names every core router and
every plugin route and cannot fall behind them the way the hand-written
pages did. ``core-endpoints.md`` and ``plugin-endpoints.md`` keep the
worked examples; this page is the complete list.

Run from the repo root (``make sync-openapi`` runs it after the snapshot)::

    python3 scripts/generate_api_reference.py          # write both pages
    python3 scripts/generate_api_reference.py --check  # exit 1 on drift

Gate contract (quality-checks.md "Gate test contract"): a missing or
unreadable snapshot, or one with no operations, exits 2 instead of
rendering an empty page, and every run prints how many operations and
areas it rendered.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Protocol

CHECK = "api-reference"
EXIT_DRIFT = 1
EXIT_FAIL_CLOSED = 2

SNAPSHOT = Path("schema") / "openapi.json"
METHOD_ORDER = ("get", "post", "put", "patch", "delete")
UNTAGGED = "Other"

TEXT = {
    "en": {
        "title": "All endpoints",
        "intro": (
            "Every endpoint of the backend and its plugins, grouped by area.\n"
            "This page is generated from the OpenAPI snapshot\n"
            "`schema/openapi.json` by `scripts/generate_api_reference.py`;\n"
            "do not edit it by hand. The request and response schemas of each\n"
            "endpoint are in that snapshot, or at `/openapi.json` on a running\n"
            "backend. Worked examples: [Core endpoints](core-endpoints.md) and\n"
            "[Plugin endpoints](plugin-endpoints.md)."
        ),
        "header": "| Method | Path | Summary |",
        "deprecated": "(deprecated)",
    },
    "de": {
        "title": "Alle Endpoints",
        "intro": (
            "Jeder Endpoint des Backends und seiner Plugins, nach Bereich\n"
            "gruppiert. Diese Seite wird von `scripts/generate_api_reference.py`\n"
            "aus dem OpenAPI-Snapshot `schema/openapi.json` erzeugt; nicht von\n"
            "Hand bearbeiten. Die Request- und Response-Schemas jedes Endpoints\n"
            "stehen in diesem Snapshot oder unter `/openapi.json` eines laufenden\n"
            "Backends. Ausgearbeitete Beispiele: [Core-Endpoints](core-endpoints.md)\n"
            "und [Plugin-Endpoints](plugin-endpoints.md)."
        ),
        "header": "| Methode | Pfad | Zusammenfassung |",
        "deprecated": "(veraltet)",
    },
    "es": {
        "title": "Todos los endpoints",
        "intro": (
            "Todos los endpoints del backend y de sus plugins, agrupados por área.\n"
            "Esta página se genera a partir del snapshot de OpenAPI\n"
            "`schema/openapi.json` con `scripts/generate_api_reference.py`;\n"
            "no la edites a mano. Los resúmenes de los endpoints proceden del\n"
            "snapshot y están en inglés. Los esquemas de petición y respuesta de\n"
            "cada endpoint están en ese snapshot o en `/openapi.json` de un backend\n"
            "en ejecución. Ejemplos desarrollados: [Endpoints del núcleo](core-endpoints.md)\n"
            "y [Endpoints de plugins](plugin-endpoints.md)."
        ),
        "header": "| Método | Ruta | Resumen |",
        "deprecated": "(obsoleto)",
    },
    "fr": {
        "title": "Tous les endpoints",
        "intro": (
            "Tous les endpoints du backend et de ses plugins, regroupés par domaine.\n"
            "Cette page est générée à partir de l'instantané OpenAPI\n"
            "`schema/openapi.json` par `scripts/generate_api_reference.py` ;\n"
            "ne la modifiez pas à la main. Les résumés des endpoints proviennent\n"
            "de l'instantané et restent en anglais. Les schémas de requête et de\n"
            "réponse de chaque endpoint figurent dans cet instantané ou sous\n"
            "`/openapi.json` d'un backend en cours d'exécution. Exemples détaillés :\n"
            "[Endpoints du cœur](core-endpoints.md) et\n"
            "[Endpoints des plugins](plugin-endpoints.md)."
        ),
        "header": "| Méthode | Chemin | Résumé |",
        "deprecated": "(obsolète)",
    },
    "el": {
        "title": "Όλα τα endpoints",
        "intro": (
            "Όλα τα endpoints του backend και των plugins του, ομαδοποιημένα ανά\n"
            "περιοχή. Η σελίδα αυτή παράγεται από το στιγμιότυπο OpenAPI\n"
            "`schema/openapi.json` μέσω `scripts/generate_api_reference.py`· μην\n"
            "την επεξεργάζεσαι με το χέρι. Οι περιλήψεις των endpoints προέρχονται\n"
            "από το στιγμιότυπο και είναι στα αγγλικά. Τα σχήματα αιτήματος και\n"
            "απόκρισης κάθε endpoint βρίσκονται σε αυτό το στιγμιότυπο ή στο\n"
            "`/openapi.json` ενός backend που εκτελείται. Αναλυτικά παραδείγματα:\n"
            "[Endpoints πυρήνα](core-endpoints.md) και\n"
            "[Endpoints plugins](plugin-endpoints.md)."
        ),
        "header": "| Μέθοδος | Διαδρομή | Περίληψη |",
        "deprecated": "(καταργημένο)",
    },
    "pt": {
        "title": "Todos os endpoints",
        "intro": (
            "Todos os endpoints do backend e dos seus plugins, agrupados por área.\n"
            "Esta página é gerada a partir do snapshot OpenAPI\n"
            "`schema/openapi.json` por `scripts/generate_api_reference.py`;\n"
            "não a edites à mão. Os resumos dos endpoints vêm do snapshot e\n"
            "estão em inglês. Os esquemas de pedido e de resposta de cada endpoint\n"
            "estão nesse snapshot ou em `/openapi.json` de um backend em execução.\n"
            "Exemplos detalhados: [Endpoints do núcleo](core-endpoints.md) e\n"
            "[Endpoints dos plugins](plugin-endpoints.md)."
        ),
        "header": "| Método | Caminho | Resumo |",
        "deprecated": "(obsoleto)",
    },
    "tr": {
        "title": "Tüm endpoint'ler",
        "intro": (
            "Backend'in ve eklentilerinin tüm endpoint'leri, alana göre\n"
            "gruplanmış. Bu sayfa `scripts/generate_api_reference.py` tarafından\n"
            "OpenAPI anlık görüntüsü `schema/openapi.json` dosyasından üretilir;\n"
            "elle düzenleme. Endpoint özetleri anlık görüntüden gelir ve\n"
            "İngilizcedir. Her endpoint'in istek ve yanıt şemaları bu anlık\n"
            "görüntüde veya çalışan bir backend'in `/openapi.json` adresinde\n"
            "bulunur. Ayrıntılı örnekler: [Çekirdek endpoint'leri](core-endpoints.md)\n"
            "ve [Eklenti endpoint'leri](plugin-endpoints.md)."
        ),
        "header": "| Yöntem | Yol | Özet |",
        "deprecated": "(kullanımdan kaldırıldı)",
    },
    "ja": {
        "title": "すべてのエンドポイント",
        "intro": (
            "バックエンドとそのプラグインのすべてのエンドポイントを領域ごとに\n"
            "まとめています。このページは `scripts/generate_api_reference.py` が\n"
            "OpenAPI スナップショット `schema/openapi.json` から生成します。手動で\n"
            "編集しないでください。エンドポイントの概要はスナップショットに由来し、\n"
            "英語のままです。各エンドポイントのリクエストとレスポンスのスキーマは、\n"
            "このスナップショットか、実行中のバックエンドの `/openapi.json` にあります。\n"
            "詳しい例: [コアのエンドポイント](core-endpoints.md) と\n"
            "[プラグインのエンドポイント](plugin-endpoints.md)。"
        ),
        "header": "| メソッド | パス | 概要 |",
        "deprecated": "（非推奨）",
    },
}

GENERATED_MARKER = (
    "<!-- Generated by scripts/generate_api_reference.py from schema/openapi.json; "
    "do not edit by hand (#3454). -->"
)


# The help pages of these locales are machine translations awaiting native
# review and open with this marker; the generated page follows suit (#3652).
TRANSLATION_MARKER = "<!-- Translation: AI-generated, pending native review -->"
MARKED_LOCALES = frozenset({"pt", "tr", "ja"})


def operations(spec: dict) -> list[tuple[str, str, str, dict]]:
    """Every operation of the spec as ``(tag, method, path, operation)``.

    An operation with several tags is listed under its first; one without
    a tag lands under ``Other``.

    Args:
        spec: The parsed OpenAPI document.

    Returns:
        The operations sorted by tag, then path, then HTTP method order.
    """
    rows = []
    for path, item in spec.get("paths", {}).items():
        for method, operation in item.items():
            if method not in METHOD_ORDER:
                continue
            tag = (operation.get("tags") or [UNTAGGED])[0]
            rows.append((tag, method, path, operation))
    return sorted(rows, key=lambda r: (r[0].lower(), r[2], METHOD_ORDER.index(r[1])))


def _cell(text: str) -> str:
    """One Markdown table cell: pipes escaped, line breaks folded."""
    return " ".join(text.split()).replace("|", "\\|")


def render(spec: dict, lang: str) -> str:
    """Render the endpoint page for one help language.

    Args:
        spec: The parsed OpenAPI document.
        lang: A help locale, a key of ``TEXT``.

    Returns:
        The complete Markdown page, ending in a newline.
    """
    text = TEXT[lang]
    lines = [GENERATED_MARKER, "", f"# {text['title']}", "", text["intro"]]
    if lang in MARKED_LOCALES:
        lines = [TRANSLATION_MARKER, "", *lines]
    current = None
    for tag, method, path, operation in operations(spec):
        if tag != current:
            lines += ["", f"## {tag}", "", text["header"], "|---|---|---|"]
            current = tag
        summary = _cell(operation.get("summary") or operation.get("operationId") or "")
        if operation.get("deprecated"):
            summary = f"{summary} {text['deprecated']}"
        lines.append(f"| `{method.upper()}` | `{path}` | {summary} |")
    return "\n".join(lines) + "\n"


def page_path(repo: Path, lang: str) -> Path:
    """Where the generated page for ``lang`` lives."""
    return repo / "docs" / "help" / lang / "api" / "endpoints.md"


def read_spec(repo: Path) -> dict:
    """Read the committed snapshot and insist it holds operations.

    Raises:
        ValueError: when the snapshot is missing, unreadable, or holds no
            operation - the caller must treat that as a failure, never as
            "nothing to render".
    """
    path = repo / SNAPSHOT
    try:
        spec = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read {SNAPSHOT}: {exc}") from exc
    if not operations(spec):
        raise ValueError(f"{SNAPSHOT} holds no operation")
    return spec


def load_spec(repo: Path) -> dict:
    """:func:`read_spec` for the command line: exits 2 instead of raising.

    Raises:
        SystemExit: with ``EXIT_FAIL_CLOSED`` when the snapshot cannot be used.
    """
    try:
        return read_spec(repo)
    except ValueError as exc:
        print(f"api-reference: FAIL-CLOSED: {exc}")
        raise SystemExit(EXIT_FAIL_CLOSED) from exc


def stale_pages(repo: Path, spec: dict) -> list[Path]:
    """The generated pages whose content differs from a fresh render."""
    stale = []
    for lang in TEXT:
        path = page_path(repo, lang)
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current != render(spec, lang):
            stale.append(path)
    return stale


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


def check_api_reference(report: _Report, repo: Path) -> None:
    """``verify_docs`` check: the generated pages match the snapshot.

    A snapshot that cannot be read FAILs (#2287); the note says how many
    operations the comparison covered, so an empty basis never reads as
    a clean one.
    """
    try:
        spec = read_spec(repo)
    except ValueError as exc:
        report.fail(CHECK, f"{exc} (basis missing; #2287)")
        return
    report.note(f"{CHECK}: {len(operations(spec))} operations against {len(TEXT)} generated pages")
    for path in stale_pages(repo, spec):
        report.fail(
            CHECK,
            f"{path.relative_to(repo)} differs from {SNAPSHOT} - "
            "run python3 scripts/generate_api_reference.py and commit it",
        )


def _repo_root() -> Path:
    """Repo root from the working directory, never from ``__file__`` (worktrees)."""
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=False
    )
    if out.returncode != 0:
        print("api-reference: FAIL-CLOSED: not inside a git checkout")
        raise SystemExit(EXIT_FAIL_CLOSED)
    return Path(out.stdout.strip())


def main(argv: list[str]) -> int:
    """Write the pages, or with ``--check`` report drift."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="exit 1 when a page is stale")
    opts = parser.parse_args(argv)

    repo = _repo_root()
    spec = load_spec(repo)
    ops = operations(spec)
    areas = len({tag for tag, *_ in ops})
    print(f"api-reference: {len(ops)} operations in {areas} areas from {SNAPSHOT}")

    stale = stale_pages(repo, spec)
    if opts.check:
        if stale:
            for path in stale:
                print(f"api-reference: DRIFT - {path.relative_to(repo)} differs from the snapshot")
            print("Run `python3 scripts/generate_api_reference.py` and commit the pages.")
            return EXIT_DRIFT
        print("api-reference: check OK - the pages match the snapshot")
        return 0
    for lang in TEXT:
        path = page_path(repo, lang)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render(spec, lang), encoding="utf-8")
        print(f"api-reference: wrote {path.relative_to(repo)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
