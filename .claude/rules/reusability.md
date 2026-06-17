# Reusability Rules

Vollstaendige Policy: docs/REUSABILITY-POLICY.md

- Props-driven: alle Daten/Callbacks ueber Props oder Seams
- Keine Seiteneffekte beim Import
- Barrel Exports (index.ts / __init__.py) fuer Modulgrenzen
- Generische Benennung (MatchingTile, nicht LessonMatchingTile)
- Token-backed Tailwind-Utilities, keine fixed-palette Klassen, keine Hardcodes
- Wiederverwendbare Teile in frontend/src/shared/ (app-unabhaengig)
- TSDoc/Docstring mit Verwendungsbeispiel Pflicht
- App-spezifischer State nur ueber Props, nie direkt importieren

## Implementierungs-Hierarchie (Sprache -> Framework -> Library -> Selbst)

Vor jeder neuen Utility die Hierarchie top-down durchgehen, bei der
ersten passenden Stufe stoppen:

1. **Sprache/Runtime zuerst** (native APIs, keine Bundle-Kosten):
   JS/TS `Intl`, `crypto.subtle`, `URL`, `fetch`, `structuredClone`,
   `Array`/`Set`/`Map`, `IntersectionObserver`; Python `pathlib`,
   `dataclasses`, `json`, `hashlib`, `functools`, `unicodedata`.
2. **Framework** (was schon da ist): React-Hooks/Context, Vite
   `define`/`import.meta.env`, FastAPI `Depends`/`BackgroundTasks`.
3. **Library** (npm/PyPI, nur wenn 1+2 nicht reichen): bereits
   vorhandene Dependency vor neuer; neue muss > 1000 weekly downloads,
   letztes Release < 6 Monate, < 100 kB fuer < 50 LOC, keine CVEs.
4. **Selbst schreiben** (nur wenn 1-3 nicht passen): Library-Grade
   (keine App-Imports, eigene Typen, TSDoc, einzeln nutzbar), Kohaesion
   < 500 Zeilen / ein Concern, Complexity cc < 20, eigene Tests, PR
   dokumentiert WARUM selbst gebaut (welche Stufe, welcher Grund).

Vollstaendige Policy: docs/VIBE-CODING-POLICY.md §7. Worked reference:
docs/audits/2026-06-17-library-first-audit.md.
